import type { Segment } from "./synthetic";

/**
 * The built-in "fake hand": a ten second performance of every gesture, replayed on a loop
 * when there is no camera. The centre of the frame is the centre object of the scene.
 */
export const DEMO_SCRIPT: Segment[] = [
  { durationMs: 700, hands: [{ pose: "open", handedness: "Right", from: { x: 0.85, y: 0.78 }, to: { x: 0.64, y: 0.56 } }] },
  { durationMs: 1000, hands: [{ pose: "point", handedness: "Right", from: { x: 0.62, y: 0.42 }, to: { x: 0.5, y: 0.48 } }] },
  { durationMs: 600, hands: [{ pose: "pinch", handedness: "Right", from: { x: 0.5, y: 0.48 } }] },
  { durationMs: 1400, hands: [{ pose: "fist", handedness: "Right", from: { x: 0.5, y: 0.55 }, to: { x: 0.68, y: 0.44 } }] },
  { durationMs: 1400, hands: [{ pose: "fist", handedness: "Right", from: { x: 0.68, y: 0.44 }, to: { x: 0.44, y: 0.6 } }] },
  { durationMs: 300, hands: [{ pose: "open", handedness: "Right", from: { x: 0.5, y: 0.55 } }] },
  {
    durationMs: 1800,
    hands: [
      { pose: "pinch", handedness: "Left", from: { x: 0.43, y: 0.52 }, to: { x: 0.27, y: 0.6 } },
      { pose: "pinch", handedness: "Right", from: { x: 0.57, y: 0.5 }, to: { x: 0.74, y: 0.42 } },
    ],
  },
  {
    durationMs: 300,
    hands: [
      { pose: "pinch", handedness: "Left", from: { x: 0.27, y: 0.6 } },
      { pose: "pinch", handedness: "Right", from: { x: 0.74, y: 0.42 } },
    ],
  },
  { durationMs: 1500, hands: [{ pose: "open", handedness: "Right", from: { x: 0.62, y: 0.52 } }] },
  { durationMs: 600, hands: [] },
];
