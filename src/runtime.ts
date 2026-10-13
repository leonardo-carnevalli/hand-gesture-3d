import { ActionMapper } from "@/gesture/actions";
import { GestureEngine } from "@/gesture/engine";
import { Recorder, type Recording } from "@/gesture/recording";
import type { Gesture, Handedness } from "@/gesture/types";
import { attachPointerControls } from "@/input/pointer";
import type { FrameSource } from "@/input/sources";
import { drawHands } from "@/scene/overlay";
import { Stage, type Quality, type StageSnapshot } from "@/scene/stage";

export interface RuntimeStatus {
  fps: number;
  trackingFps: number;
  hands: { handedness: Handedness; gesture: Gesture; confidence: number }[];
  stage: StageSnapshot;
  recordedFrames: number | null;
}

const STATUS_INTERVAL_MS = 125;

/**
 * The per-frame pipeline, kept out of React: source -> engine -> mapper -> stage -> overlay.
 * React only receives a status snapshot a few times per second.
 */
export class Runtime {
  private readonly stage: Stage;
  private readonly overlay: CanvasRenderingContext2D;
  private readonly detachPointer: () => void;
  private readonly resizeObserver: ResizeObserver;
  private source: FrameSource | null = null;
  private engine = new GestureEngine();
  private mapper = new ActionMapper();
  private recorder: Recorder | null = null;
  private lastStatus: RuntimeStatus["hands"] = [];
  private raf = 0;
  private lastFrameAt = 0;
  private frames = 0;
  private tracked = 0;
  private windowStart = 0;

  constructor(
    private readonly container: HTMLElement,
    canvas: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    private readonly onStatus: (status: RuntimeStatus) => void,
  ) {
    this.stage = new Stage(canvas);
    const ctx = overlay.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.overlay = ctx;
    this.detachPointer = attachPointerControls(container, (actions) => this.stage.apply(actions));
    this.resizeObserver = new ResizeObserver(() => this.resize(overlay));
    this.resizeObserver.observe(container);
    this.resize(overlay);
    this.raf = requestAnimationFrame(this.loop);
  }

  setSource(source: FrameSource | null): void {
    this.source?.dispose();
    this.source = source;
    const aspect = source?.aspect;
    this.engine = new GestureEngine(aspect ? { aspect } : {});
    this.mapper = new ActionMapper(aspect ? { aspect } : {});
    this.lastStatus = [];
    this.stage.clearHover();
    this.overlay.clearRect(0, 0, this.overlay.canvas.width, this.overlay.canvas.height);
  }

  setQuality(quality: Quality): void {
    this.stage.setQuality(quality);
  }

  startRecording(): void {
    this.recorder = new Recorder();
  }

  /** Stops recording and returns what was captured, ready to save as a test fixture. */
  stopRecording(): Recording | null {
    const recorder = this.recorder;
    this.recorder = null;
    return recorder && recorder.size > 0 && this.source ? recorder.toRecording(this.source.aspect) : null;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.detachPointer();
    this.source?.dispose();
    this.stage.dispose();
  }

  private resize(overlay: HTMLCanvasElement): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.stage.resize(w, h);
    const dpr = Math.min(window.devicePixelRatio, 2);
    overlay.width = Math.round(w * dpr);
    overlay.height = Math.round(h * dpr);
  }

  private readonly loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const frame = this.source?.next(now);
    if (frame) {
      this.tracked++;
      this.recorder?.add(frame);
      const out = this.engine.process(frame);
      const actions = this.mapper.update(out);
      this.stage.apply(actions);
      if (!actions.some((a) => a.type === "hover")) this.stage.clearHover();
      drawHands(this.overlay, out.hands);
      this.lastStatus = out.hands.map(({ handedness, gesture, confidence }) => ({ handedness, gesture, confidence }));
    }

    this.stage.render(this.lastFrameAt ? now - this.lastFrameAt : 16);
    this.lastFrameAt = now;
    this.frames++;

    const elapsed = now - this.windowStart;
    if (elapsed >= STATUS_INTERVAL_MS) {
      this.onStatus({
        fps: (this.frames * 1000) / elapsed,
        trackingFps: (this.tracked * 1000) / elapsed,
        hands: this.lastStatus,
        stage: this.stage.snapshot(),
        recordedFrames: this.recorder?.size ?? null,
      });
      this.frames = 0;
      this.tracked = 0;
      this.windowStart = now;
    }
  };
}
