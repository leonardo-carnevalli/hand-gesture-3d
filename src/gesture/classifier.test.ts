import { describe, expect, it } from "vitest";
import { classifyPose } from "./classifier";
import { extractFeatures, pointerOf } from "./features";
import { placeHand, POSES } from "./synthetic";
import type { Gesture, Handedness } from "./types";

const POSE_NAMES = Object.keys(POSES) as (keyof typeof POSES)[];

function classify(pose: keyof typeof POSES, opts: { handedness?: Handedness; roll?: number; size?: number; aspect?: number; previous?: Gesture } = {}) {
  const aspect = opts.aspect ?? 16 / 9;
  const landmarks = placeHand(
    { pose, handedness: opts.handedness ?? "Right", at: { x: 0.5, y: 0.5 }, size: opts.size ?? 0.25, roll: opts.roll },
    aspect,
  );
  return classifyPose(extractFeatures(landmarks, aspect), opts.previous ?? "none");
}

describe("classifyPose", () => {
  it.each(POSE_NAMES)("recognises %s with high confidence", (pose) => {
    const result = classify(pose);
    expect(result.gesture).toBe(pose);
    expect(result.confidence).toBeGreaterThan(0.75);
  });

  it.each(POSE_NAMES)("recognises %s regardless of hand, size, roll and frame aspect", (pose) => {
    for (const handedness of ["Left", "Right"] as const) {
      for (const roll of [-0.6, 0, 0.6]) {
        for (const size of [0.12, 0.35]) {
          for (const aspect of [4 / 3, 16 / 9, 9 / 16]) {
            expect(classify(pose, { handedness, roll, size, aspect }).gesture).toBe(pose);
          }
        }
      }
    }
  });

  it("does not read a fist as a pinch even though thumb and index touch", () => {
    const aspect = 16 / 9;
    const f = extractFeatures(placeHand({ pose: "fist", handedness: "Right", at: { x: 0.5, y: 0.5 }, size: 0.25 }, aspect), aspect);
    expect(f.pinch).toBeLessThan(0.3);
    expect(classifyPose(f, "none").gesture).toBe("fist");
  });

  it("uses hysteresis: a half-open pinch stays a pinch but does not start one", () => {
    const features = { extension: [0.2, 1, 1, 1] as [number, number, number, number], pinch: 0.38, reach: 1.2 };
    expect(classifyPose(features, "pinch").gesture).toBe("pinch");
    expect(classifyPose(features, "open").gesture).not.toBe("pinch");
  });

  it("returns none with zero confidence for an ambiguous hand", () => {
    // Index and middle up, ring and pinky down: a "peace" sign is not in the vocabulary.
    const result = classifyPose({ extension: [1, 1, 0, 0], pinch: 1.2, reach: 1.8 }, "none");
    expect(result).toEqual({ gesture: "none", confidence: 0 });
  });

  it("confidence grows with how clean the pose is", () => {
    const clean = classifyPose({ extension: [1, 1, 1, 1], pinch: 1.2, reach: 1.8 }, "none");
    const sloppy = classifyPose({ extension: [0.6, 0.7, 0.55, 0.6], pinch: 1.2, reach: 1.8 }, "none");
    expect(clean.gesture).toBe("open");
    expect(sloppy.gesture).toBe("open");
    expect(clean.confidence).toBeGreaterThan(sloppy.confidence);
  });
});

describe("pointerOf", () => {
  it("puts the pointer on the fingertip, the pinch point or the palm", () => {
    for (const pose of POSE_NAMES) {
      const at = { x: 0.31, y: 0.62 };
      const landmarks = placeHand({ pose, handedness: "Right", at, size: 0.25 }, 16 / 9);
      const p = pointerOf(pose, landmarks);
      expect(p.x).toBeCloseTo(at.x, 6);
      expect(p.y).toBeCloseTo(at.y, 6);
    }
  });
});
