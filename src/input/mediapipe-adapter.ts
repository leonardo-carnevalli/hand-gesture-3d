import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Frame, HandObservation } from "@/gesture/types";

/**
 * Converts a HandLandmarker result from the raw (unmirrored) webcam image into view space,
 * the mirrored picture the user expects to see of themselves.
 *
 * MediaPipe labels handedness as if the image were already mirrored, so on a raw selfie camera
 * its "Left" is the user's right hand. Flipping x and swapping the label fixes both at once.
 */
export function toViewFrame(result: HandLandmarkerResult, t: number): Frame {
  const hands = result.landmarks.flatMap((landmarks, i): HandObservation[] => {
    const category = result.handedness[i]?.[0];
    if (!category) return [];
    return [
      {
        handedness: category.categoryName === "Left" ? "Right" : "Left",
        score: category.score,
        landmarks: landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
      },
    ];
  });
  return { t, hands };
}
