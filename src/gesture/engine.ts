import { classifyPose, DEFAULT_THRESHOLDS, type ClassifierThresholds } from "./classifier";
import { GestureDebouncer } from "./debouncer";
import { extractFeatures, pointerOf } from "./features";
import { DEFAULT_ONE_EURO, type OneEuroParams } from "./one-euro";
import { LandmarkSmoother } from "./smoother";
import { LM, type EngineOutput, type Frame, type Handedness, type HandObservation, type TrackedHand } from "./types";

export interface EngineOptions {
  /** Width / height of the source frame. */
  aspect: number;
  /** Hands the detector is less sure about are ignored. */
  minHandScore: number;
  /** Debounce window for gesture changes. */
  holdMs: number;
  smoothing: OneEuroParams;
  thresholds: ClassifierThresholds;
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  aspect: 16 / 9,
  minHandScore: 0.6,
  holdMs: 90,
  smoothing: DEFAULT_ONE_EURO,
  thresholds: DEFAULT_THRESHOLDS,
};

interface HandState {
  smoother: LandmarkSmoother;
  debouncer: GestureDebouncer;
}

/**
 * The detector sometimes labels both hands the same. In the mirrored view the user's left hand
 * is the one on the left, so duplicates are resolved by wrist position.
 */
export function resolveHandedness(hands: HandObservation[]): HandObservation[] {
  const top = [...hands].sort((a, b) => b.score - a.score).slice(0, 2);
  if (top.length < 2 || top[0].handedness !== top[1].handedness) return top;
  const [left, right] = [...top].sort((a, b) => a.landmarks[LM.wrist].x - b.landmarks[LM.wrist].x);
  return [
    { ...left, handedness: "Left" },
    { ...right, handedness: "Right" },
  ];
}

/** Landmarks in, stable gestures out. Pure apart from its own per-hand filter state. */
export class GestureEngine {
  private readonly options: EngineOptions;
  private states = new Map<Handedness, HandState>();

  constructor(options: Partial<EngineOptions> = {}) {
    this.options = { ...DEFAULT_ENGINE_OPTIONS, ...options };
  }

  process(frame: Frame): EngineOutput {
    const { aspect, minHandScore, holdMs, smoothing, thresholds } = this.options;
    const visible = resolveHandedness(frame.hands.filter((h) => h.score >= minHandScore));
    const next = new Map<Handedness, HandState>();

    const hands = visible.map((hand): TrackedHand => {
      const state = this.states.get(hand.handedness) ?? {
        smoother: new LandmarkSmoother(smoothing),
        debouncer: new GestureDebouncer(holdMs),
      };
      next.set(hand.handedness, state);

      const landmarks = state.smoother.smooth(hand.landmarks, frame.t);
      const raw = classifyPose(extractFeatures(landmarks, aspect), state.debouncer.current, thresholds);
      const stable = state.debouncer.update(raw, frame.t);
      return {
        handedness: hand.handedness,
        landmarks,
        gesture: stable.gesture,
        confidence: stable.confidence * hand.score,
        pointer: pointerOf(stable.gesture, landmarks),
      };
    });

    // A hand that left the frame starts from scratch when it comes back: no stale filter, no stale grab.
    this.states = next;
    return { t: frame.t, hands };
  }
}
