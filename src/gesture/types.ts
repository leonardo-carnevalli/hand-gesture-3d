/** A landmark in view space: x and y normalised to [0, 1] of the (mirrored) camera frame, y pointing down. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Which hand, from the user's point of view. */
export type Handedness = "Left" | "Right";

/** One detected hand: 21 MediaPipe landmarks plus the detector's own confidence. */
export interface HandObservation {
  handedness: Handedness;
  /** Detector confidence for this hand, 0..1. */
  score: number;
  landmarks: Point3[];
}

/** Everything the tracker saw at one instant. */
export interface Frame {
  /** Milliseconds, monotonic. */
  t: number;
  hands: HandObservation[];
}

export type Gesture = "none" | "open" | "fist" | "pinch" | "point";

/** A hand after smoothing, classification and debouncing. */
export interface TrackedHand {
  handedness: Handedness;
  landmarks: Point3[];
  gesture: Gesture;
  /** Confidence of the gesture, already weighted by the detector score. */
  confidence: number;
  /** Where this hand "points" on screen for its current gesture. */
  pointer: { x: number; y: number };
}

export interface EngineOutput {
  t: number;
  hands: TrackedHand[];
}

/** MediaPipe hand landmark indices used by the engine. */
export const LM = {
  wrist: 0,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyTip: 20,
} as const;

export const LANDMARK_COUNT = 21;
