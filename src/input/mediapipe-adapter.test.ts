import { describe, expect, it } from "vitest";
import { toViewFrame } from "./mediapipe-adapter";

const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: 0.2, y: i / 21, z: -0.01, visibility: 1 }));
const category = (categoryName: string, score: number) => [{ categoryName, score, index: 0, displayName: categoryName }];

describe("toViewFrame", () => {
  it("mirrors x and swaps MediaPipe's handedness for a raw selfie camera", () => {
    const frame = toViewFrame(
      { landmarks: [landmarks], worldLandmarks: [], handedness: [category("Left", 0.97)], handednesses: [] },
      1234,
    );
    expect(frame.t).toBe(1234);
    expect(frame.hands[0].handedness).toBe("Right");
    expect(frame.hands[0].score).toBe(0.97);
    expect(frame.hands[0].landmarks[0].x).toBeCloseTo(0.8);
    expect(frame.hands[0].landmarks[3].y).toBeCloseTo(3 / 21);
  });

  it("skips a hand without a handedness category", () => {
    const frame = toViewFrame({ landmarks: [landmarks], worldLandmarks: [], handedness: [], handednesses: [] }, 0);
    expect(frame.hands).toEqual([]);
  });
});
