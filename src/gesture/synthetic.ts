import { pointerOf } from "./features";
import type { Recording } from "./recording";
import type { Frame, Gesture, Handedness, HandObservation, Point3 } from "./types";

/**
 * A synthetic right hand seen in the mirrored view, palm to the camera, fingers up.
 * Units are hand sizes (wrist to middle knuckle = 1), x to the right, y down, wrist at the origin.
 */
type Pose = [number, number][];

const OPEN: Pose = [
  [0, 0],
  [-0.25, -0.15], [-0.5, -0.35], [-0.7, -0.5], [-0.85, -0.65],
  [-0.3, -0.95], [-0.36, -1.35], [-0.4, -1.6], [-0.43, -1.82],
  [0, -1], [0, -1.45], [0, -1.72], [0, -1.95],
  [0.25, -0.95], [0.3, -1.35], [0.33, -1.6], [0.36, -1.8],
  [0.45, -0.85], [0.55, -1.15], [0.6, -1.35], [0.65, -1.5],
];

const CURLED = {
  index: [[-0.3, -0.95], [-0.33, -1.2], [-0.3, -1.0], [-0.27, -0.85]],
  middle: [[0, -1], [0, -1.25], [0.02, -1.02], [0.03, -0.88]],
  ring: [[0.25, -0.95], [0.27, -1.18], [0.25, -0.98], [0.23, -0.85]],
  pinky: [[0.45, -0.85], [0.5, -1.03], [0.46, -0.88], [0.42, -0.78]],
  thumbTucked: [[-0.25, -0.15], [-0.4, -0.4], [-0.3, -0.65], [-0.12, -0.75]],
} satisfies Record<string, Pose>;

function withFingers(base: Pose, replacements: Record<number, Pose>): Pose {
  const pose = base.map((p) => [...p] as [number, number]);
  for (const [start, points] of Object.entries(replacements)) {
    points.forEach((p, i) => (pose[Number(start) + i] = [...p]));
  }
  return pose;
}

export const POSES: Record<Exclude<Gesture, "none">, Pose> = {
  open: OPEN,
  fist: withFingers(OPEN, { 1: CURLED.thumbTucked, 5: CURLED.index, 9: CURLED.middle, 13: CURLED.ring, 17: CURLED.pinky }),
  point: withFingers(OPEN, { 1: CURLED.thumbTucked, 9: CURLED.middle, 13: CURLED.ring, 17: CURLED.pinky }),
  // "OK" pinch: thumb and index tips meet, the other fingers stay relaxed and open.
  pinch: withFingers(OPEN, {
    1: [[-0.25, -0.15], [-0.45, -0.4], [-0.52, -0.7], [-0.5, -1.0]],
    5: [[-0.3, -0.95], [-0.42, -1.3], [-0.5, -1.2], [-0.52, -1.05]],
  }),
};

export interface HandPlacement {
  pose: Exclude<Gesture, "none">;
  handedness: Handedness;
  /** Where the gesture's own pointer (fingertip, pinch point or palm) should land, normalised. */
  at: { x: number; y: number };
  /** Hand size as a fraction of the frame height. */
  size: number;
  /** In-plane rotation, radians. */
  roll?: number;
}

/** Places a pose in the frame so that its pointer lands exactly on `at`. */
export function placeHand(p: HandPlacement, aspect: number): Point3[] {
  const mirror = p.handedness === "Left" ? -1 : 1;
  const cos = Math.cos(p.roll ?? 0);
  const sin = Math.sin(p.roll ?? 0);
  const local = POSES[p.pose].map(([lx, ly]) => {
    const x = lx * mirror;
    return { x: ((x * cos - ly * sin) * p.size) / aspect, y: (x * sin + ly * cos) * p.size, z: 0 };
  });
  const anchor = pointerOf(p.pose, local);
  return local.map((q) => ({ x: q.x - anchor.x + p.at.x, y: q.y - anchor.y + p.at.y, z: 0 }));
}

/** Small deterministic PRNG (mulberry32) so noisy fixtures are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One step of a scripted performance: the hands move linearly from `from` to `to`. */
export interface Segment {
  durationMs: number;
  hands: { pose: HandPlacement["pose"]; handedness: Handedness; from: { x: number; y: number }; to?: { x: number; y: number } }[];
}

export interface SynthesisOptions {
  aspect?: number;
  fps?: number;
  /** Hand size as a fraction of frame height. */
  size?: number;
  /** Standard deviation-ish of the per-landmark jitter, normalised units. */
  noise?: number;
  seed?: number;
}

/** Renders a script into a recording, as if a tracker had watched someone perform it. */
export function synthesize(script: Segment[], options: SynthesisOptions = {}): Recording {
  const { aspect = 16 / 9, fps = 30, size = 0.22, noise = 0, seed = 1 } = options;
  const random = seededRandom(seed);
  const jitter = () => (random() + random() + random() - 1.5) * noise;
  const frames: Frame[] = [];
  let start = 0;
  for (const segment of script) {
    const steps = Math.max(1, Math.round((segment.durationMs / 1000) * fps));
    for (let i = 0; i < steps; i++) {
      const k = steps === 1 ? 1 : i / (steps - 1);
      const hands = segment.hands.map((h): HandObservation => {
        const to = h.to ?? h.from;
        const at = { x: h.from.x + (to.x - h.from.x) * k, y: h.from.y + (to.y - h.from.y) * k };
        const landmarks = placeHand({ pose: h.pose, handedness: h.handedness, at, size }, aspect).map((p) => ({
          x: p.x + jitter(),
          y: p.y + jitter(),
          z: p.z,
        }));
        return { handedness: h.handedness, score: 0.95, landmarks };
      });
      frames.push({ t: start + (i * 1000) / fps, hands });
    }
    start += steps * (1000 / fps);
  }
  return { version: 1, aspect, frames };
}
