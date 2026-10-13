import { clamp01, type PoseFeatures } from "./features";
import type { Gesture } from "./types";

export interface ClassifierThresholds {
  /** Pinch distance (hand sizes) below which a pinch starts. */
  pinchEnter: number;
  /** Pinch distance above which an ongoing pinch ends. Larger than `pinchEnter`: hysteresis. */
  pinchExit: number;
  /** Minimum index reach for a pinch, so a fist with the thumb on the index is not a pinch. */
  pinchMinReach: number;
  /** Extension above which a finger counts as straight. */
  extended: number;
}

export const DEFAULT_THRESHOLDS: ClassifierThresholds = {
  pinchEnter: 0.3,
  pinchExit: 0.45,
  pinchMinReach: 1,
  extended: 0.5,
};

export interface Classification {
  gesture: Gesture;
  /** 0 for "none"; an accepted gesture scores 0.5 at its threshold and 1 at a perfect pose. */
  confidence: number;
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const accepted = (gesture: Gesture, margin: number): Classification => ({
  gesture,
  confidence: 0.5 + 0.5 * clamp01(margin),
});

/**
 * Rule-based pose classifier. Rules are ordered from most to least specific.
 * `previous` is the last stable gesture of the same hand and only widens the pinch threshold.
 */
export function classifyPose(
  f: PoseFeatures,
  previous: Gesture,
  th: ClassifierThresholds = DEFAULT_THRESHOLDS,
): Classification {
  const straight = f.extension.map((e) => e >= th.extended);
  const [index, ...others] = f.extension;
  const anyOtherStraight = straight.slice(1).some(Boolean);

  const pinchLimit = previous === "pinch" ? th.pinchExit : th.pinchEnter;
  if (f.pinch < pinchLimit && (f.reach > th.pinchMinReach || anyOtherStraight)) {
    return accepted("pinch", 1 - f.pinch / pinchLimit);
  }
  if (straight.every((s) => !s)) {
    return accepted("fist", mean(f.extension.map((e) => (th.extended - e) / th.extended)));
  }
  if (straight[0] && !anyOtherStraight) {
    const margin = Math.min(index - th.extended, ...others.map((e) => th.extended - e)) / th.extended;
    return accepted("point", margin);
  }
  if (straight.every(Boolean)) {
    return accepted("open", mean(f.extension.map((e) => (e - th.extended) / (1 - th.extended))));
  }
  return { gesture: "none", confidence: 0 };
}
