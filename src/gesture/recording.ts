import { LANDMARK_COUNT, type Frame, type HandObservation, type Point3 } from "./types";

/** A landmark sequence that can be replayed instead of a camera: by tests, by CI and by the demo. */
export interface Recording {
  version: 1;
  /** Width / height of the frame the landmarks were normalised against. */
  aspect: number;
  /** Frames with `t` starting at 0, in milliseconds. */
  frames: Frame[];
}

/** On disk each landmark is a compact `[x, y, z]` triple. */
interface RecordingJson {
  version: 1;
  aspect: number;
  frames: { t: number; hands: { handedness: string; score: number; landmarks: number[][] }[] }[];
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

export function toRecordingJson(recording: Recording): RecordingJson {
  return {
    version: 1,
    aspect: round(recording.aspect),
    frames: recording.frames.map((f) => ({
      t: Math.round(f.t),
      hands: f.hands.map((h) => ({
        handedness: h.handedness,
        score: round(h.score),
        landmarks: h.landmarks.map((p) => [round(p.x), round(p.y), round(p.z)]),
      })),
    })),
  };
}

function fail(message: string): never {
  throw new Error(`Invalid recording: ${message}`);
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseHand(raw: unknown, where: string): HandObservation {
  if (typeof raw !== "object" || raw === null) fail(`${where} is not an object`);
  const { handedness, score, landmarks } = raw as Record<string, unknown>;
  if (handedness !== "Left" && handedness !== "Right") fail(`${where}.handedness must be "Left" or "Right"`);
  if (!isFiniteNumber(score) || score < 0 || score > 1) fail(`${where}.score must be within 0..1`);
  if (!Array.isArray(landmarks) || landmarks.length !== LANDMARK_COUNT) {
    fail(`${where}.landmarks must hold ${LANDMARK_COUNT} points`);
  }
  const points = landmarks.map((p, i): Point3 => {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(isFiniteNumber)) fail(`${where}.landmarks[${i}] must be [x, y, z]`);
    return { x: p[0], y: p[1], z: p[2] };
  });
  return { handedness, score, landmarks: points };
}

/** Proves the shape of untrusted JSON (a fixture or a user-loaded file) before anything uses it. */
export function parseRecording(raw: unknown): Recording {
  if (typeof raw !== "object" || raw === null) fail("not an object");
  const { version, aspect, frames } = raw as Record<string, unknown>;
  if (version !== 1) fail("unsupported version");
  if (!isFiniteNumber(aspect) || aspect <= 0) fail("aspect must be a positive number");
  if (!Array.isArray(frames) || frames.length === 0) fail("frames must be a non-empty array");
  let lastT = -Infinity;
  const parsed = frames.map((f, i): Frame => {
    if (typeof f !== "object" || f === null) fail(`frames[${i}] is not an object`);
    const { t, hands } = f as Record<string, unknown>;
    if (!isFiniteNumber(t) || t < lastT) fail(`frames[${i}].t must be a non-decreasing number`);
    lastT = t;
    if (!Array.isArray(hands)) fail(`frames[${i}].hands must be an array`);
    return { t, hands: hands.map((h, j) => parseHand(h, `frames[${i}].hands[${j}]`)) };
  });
  return { version: 1, aspect, frames: parsed };
}

/** The frame showing at `tMs` when the recording plays on a loop. */
export function frameAt(recording: Recording, tMs: number): Frame {
  const { frames } = recording;
  const duration = frames[frames.length - 1].t + 1;
  const local = ((tMs % duration) + duration) % duration;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= local) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

/** Captures live frames so a real session can become a test fixture. */
export class Recorder {
  private frames: Frame[] = [];
  private t0: number | null = null;

  add(frame: Frame): void {
    this.t0 ??= frame.t;
    this.frames.push({ t: frame.t - this.t0, hands: frame.hands });
  }

  get size(): number {
    return this.frames.length;
  }

  toRecording(aspect: number): Recording {
    return { version: 1, aspect, frames: this.frames };
  }
}
