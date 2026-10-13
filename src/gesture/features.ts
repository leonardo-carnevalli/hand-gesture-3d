import { LM, type Gesture, type Point3 } from "./types";

/**
 * Landmarks are normalised separately on x and y, so a 16:9 frame squashes x.
 * Every distance multiplies x (and z, which MediaPipe scales like x) by the aspect ratio
 * to measure the hand in square units.
 */
export function distance(a: Point3, b: Point3, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y, (a.z - b.z) * aspect);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Shape of a hand, independent of where it is, how big it looks and how it is rotated. */
export interface PoseFeatures {
  /** Extension of index, middle, ring and pinky: 0 curled, 1 straight. */
  extension: [number, number, number, number];
  /** Thumb tip to index tip, in hand sizes. */
  pinch: number;
  /** Index tip to wrist, in hand sizes. A fist folds it into the palm; a pinch keeps it out. */
  reach: number;
}

const FINGERS = [
  [LM.indexPip, LM.indexTip],
  [LM.middlePip, LM.middleTip],
  [LM.ringPip, LM.ringTip],
  [LM.pinkyPip, LM.pinkyTip],
] as const;

// A straight finger puts its tip about 1.3x farther from the wrist than its middle joint;
// a curled one brings the tip back closer than the joint.
const CURLED_RATIO = 0.85;
const STRAIGHT_RATIO = 1.2;

export function extractFeatures(lm: Point3[], aspect: number): PoseFeatures {
  const wrist = lm[LM.wrist];
  const handSize = Math.max(distance(wrist, lm[LM.middleMcp], aspect), 1e-6);
  const extension = FINGERS.map(([pip, tip]) => {
    const ratio = distance(lm[tip], wrist, aspect) / Math.max(distance(lm[pip], wrist, aspect), 1e-6);
    return clamp01((ratio - CURLED_RATIO) / (STRAIGHT_RATIO - CURLED_RATIO));
  }) as PoseFeatures["extension"];
  return {
    extension,
    pinch: distance(lm[LM.thumbTip], lm[LM.indexTip], aspect) / handSize,
    reach: distance(lm[LM.indexTip], wrist, aspect) / handSize,
  };
}

/** The screen point a gesture acts on: fingertip for point, pinch midpoint for pinch, palm otherwise. */
export function pointerOf(gesture: Gesture, lm: Point3[]): { x: number; y: number } {
  if (gesture === "point") return { x: lm[LM.indexTip].x, y: lm[LM.indexTip].y };
  if (gesture === "pinch") {
    const a = lm[LM.thumbTip];
    const b = lm[LM.indexTip];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const palm = [LM.wrist, LM.indexMcp, LM.middleMcp, LM.ringMcp, LM.pinkyMcp].map((i) => lm[i]);
  return {
    x: palm.reduce((s, p) => s + p.x, 0) / palm.length,
    y: palm.reduce((s, p) => s + p.y, 0) / palm.length,
  };
}
