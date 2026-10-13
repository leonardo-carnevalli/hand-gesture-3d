"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEMO_SCRIPT } from "@/gesture/demo-script";
import { parseRecording, toRecordingJson, type Recording } from "@/gesture/recording";
import { synthesize } from "@/gesture/synthetic";
import { CameraStartError, cameraSource, replaySource } from "@/input/sources";
import { Runtime, type RuntimeStatus } from "@/runtime";
import type { Quality } from "@/scene/stage";
import { Hud, type Mode } from "./Hud";
import { StartCard } from "./StartCard";

const CAMERA_MESSAGES: Record<CameraStartError["reason"], string> = {
  denied: "Camera permission was denied. Mouse and touch controls still work, or watch the demo replay.",
  unavailable: "No camera found. Mouse and touch controls still work, or watch the demo replay.",
  model: "The hand model could not load. Check your connection and try again.",
};

const noop = () => () => {};
/** `?replay=demo` starts the fake hand straight away: used by the screenshots and the end-to-end test. */
const readAutoDemo = () => new URLSearchParams(window.location.search).get("replay") === "demo";

export function GestureApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);

  const autoDemo = useSyncExternalStore(noop, readAutoDemo, () => false);
  // null until the visitor picks an input; the camera never opens on its own.
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode = chosenMode ?? (autoDemo ? "replay" : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [quality, setQualityState] = useState<Quality>("high");

  useEffect(() => {
    const runtime = new Runtime(containerRef.current!, canvasRef.current!, overlayRef.current!, setStatus);
    runtimeRef.current = runtime;
    if (readAutoDemo()) runtime.setSource(replaySource(synthesize(DEMO_SCRIPT), performance.now()));
    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const playRecording = useCallback((recording: Recording) => {
    runtimeRef.current?.setSource(replaySource(recording, performance.now()));
    setMode("replay");
    setMessage(null);
  }, []);

  const startDemo = useCallback(() => playRecording(synthesize(DEMO_SCRIPT)), [playRecording]);

  const startCamera = useCallback(async () => {
    setBusy(true);
    setMessage("Loading the hand model (about 8 MB, cached after the first visit)…");
    try {
      const source = await cameraSource(videoRef.current!);
      runtimeRef.current?.setSource(source);
      setMode("camera");
      setMessage(null);
    } catch (error) {
      const reason = error instanceof CameraStartError ? error.reason : "unavailable";
      runtimeRef.current?.setSource(null);
      setMode("mouse");
      setMessage(CAMERA_MESSAGES[reason]);
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseMouse = useCallback(() => {
    runtimeRef.current?.setSource(null);
    setMode("mouse");
    setMessage(null);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        playRecording(parseRecording(JSON.parse(await file.text())));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "That file is not a recording.");
      }
    },
    [playRecording],
  );

  const toggleRecording = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (status?.recordedFrames == null) {
      runtime.startRecording();
      return;
    }
    const recording = runtime.stopRecording();
    if (!recording) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(toRecordingJson(recording))], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hand-recording-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [status]);

  const setQuality = useCallback((next: Quality) => {
    runtimeRef.current?.setQuality(next);
    setQualityState(next);
  }, []);

  const stage = status?.stage;
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas text-ink">
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none select-none"
        data-testid="stage"
        data-mode={mode ?? "none"}
        data-selected={stage?.selected}
        data-rotation-x={stage?.rotation.x.toFixed(1)}
        data-rotation-y={stage?.rotation.y.toFixed(1)}
        data-rotation-z={stage?.rotation.z.toFixed(1)}
        data-scale={stage?.scale.toFixed(3)}
        data-gestures={status?.hands.map((h) => h.gesture).join(",")}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="3D scene" role="img" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      </div>

      <video
        ref={videoRef}
        className={`pointer-events-none absolute bottom-4 left-4 w-40 -scale-x-100 rounded-lg border border-line opacity-80 sm:w-56 ${mode === "camera" ? "" : "hidden"}`}
        playsInline
        muted
        aria-label="Your camera, mirrored. It is analysed on this device only."
      />

      <Hud
        mode={mode ?? "mouse"}
        status={status}
        quality={quality}
        message={message}
        busy={busy}
        onCamera={startCamera}
        onDemo={startDemo}
        onMouse={chooseMouse}
        onLoadFile={loadFile}
        onToggleRecording={toggleRecording}
        onQuality={setQuality}
      />

      {mode === null && <StartCard busy={busy} onCamera={startCamera} onDemo={startDemo} onMouse={chooseMouse} />}
    </main>
  );
}
