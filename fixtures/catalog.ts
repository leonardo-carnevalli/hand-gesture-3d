import { DEMO_SCRIPT } from "../src/gesture/demo-script";
import type { Recording } from "../src/gesture/recording";
import { synthesize, type Segment } from "../src/gesture/synthetic";

const right = (pose: Segment["hands"][number]["pose"], from: { x: number; y: number }, to?: { x: number; y: number }) => ({
  pose,
  handedness: "Right" as const,
  from,
  to,
});

/**
 * Every landmark fixture, keyed by file name. `npm run fixtures` writes them to JSON and a test
 * fails if a committed file drifts from its definition here.
 */
export const FIXTURES: Record<string, () => Recording> = {
  "open-hold": () => synthesize([{ durationMs: 1500, hands: [right("open", { x: 0.5, y: 0.5 })] }]),
  "point-hover": () =>
    synthesize([{ durationMs: 1000, hands: [right("point", { x: 0.3, y: 0.4 }, { x: 0.7, y: 0.6 })] }]),
  "pinch-select": () =>
    synthesize([
      { durationMs: 400, hands: [right("open", { x: 0.5, y: 0.5 })] },
      { durationMs: 600, hands: [right("pinch", { x: 0.5, y: 0.5 })] },
      { durationMs: 400, hands: [right("open", { x: 0.5, y: 0.5 })] },
    ]),
  "fist-drag": () => synthesize([{ durationMs: 1000, hands: [right("fist", { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 })] }]),
  "two-hand-zoom": () =>
    synthesize([
      {
        durationMs: 1200,
        hands: [
          { pose: "pinch", handedness: "Left", from: { x: 0.4, y: 0.5 }, to: { x: 0.2, y: 0.5 } },
          right("pinch", { x: 0.6, y: 0.5 }, { x: 0.8, y: 0.5 }),
        ],
      },
    ]),
  "demo-noisy": () => synthesize(DEMO_SCRIPT, { noise: 0.004, seed: 7 }),
};
