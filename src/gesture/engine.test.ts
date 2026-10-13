import { describe, expect, it } from "vitest";
import { loadFixture } from "../../fixtures/load";
import { GestureEngine, resolveHandedness } from "./engine";
import type { Recording } from "./recording";
import { placeHand } from "./synthetic";
import type { EngineOutput } from "./types";

function run(recording: Recording): EngineOutput[] {
  const engine = new GestureEngine({ aspect: recording.aspect });
  return recording.frames.map((f) => engine.process(f));
}

/** Collapses a per-frame gesture track into the sequence of distinct gestures ("-" means no hand). */
function timeline(outputs: EngineOutput[], handedness: "Left" | "Right" = "Right"): string[] {
  const track = outputs.map((o) => o.hands.find((h) => h.handedness === handedness)?.gesture ?? "-");
  return track.filter((g, i) => g !== track[i - 1]);
}

describe("GestureEngine on recorded fixtures", () => {
  it("open-hold: a still open palm", () => {
    expect(timeline(run(loadFixture("open-hold")))).toEqual(["none", "open"]);
  });

  it("pinch-select: open, pinch, open", () => {
    expect(timeline(run(loadFixture("pinch-select")))).toEqual(["none", "open", "pinch", "open"]);
  });

  it("fist-drag: the pointer follows the hand across the frame", () => {
    const outputs = run(loadFixture("fist-drag"));
    expect(timeline(outputs)).toEqual(["none", "fist"]);
    expect(outputs[outputs.length - 1].hands[0].pointer.x).toBeGreaterThan(0.6);
  });

  it("two-hand-zoom: both hands are tracked and pinching", () => {
    const outputs = run(loadFixture("two-hand-zoom"));
    expect(timeline(outputs, "Left")).toEqual(["none", "pinch"]);
    expect(timeline(outputs, "Right")).toEqual(["none", "pinch"]);
  });

  it("demo-noisy: every gesture of the demo survives jitter, with no flicker", () => {
    expect(timeline(run(loadFixture("demo-noisy")))).toEqual(["none", "open", "point", "pinch", "fist", "open", "pinch", "open", "-"]);
  });

  it("reports confidence weighted by the detector score", () => {
    const outputs = run(loadFixture("open-hold"));
    const hand = outputs[outputs.length - 1].hands[0];
    expect(hand.confidence).toBeGreaterThan(0.7);
    expect(hand.confidence).toBeLessThanOrEqual(0.95);
  });

  it("is deterministic", () => {
    const recording = loadFixture("demo-noisy");
    expect(run(recording)).toEqual(run(recording));
  });
});

describe("GestureEngine behaviour", () => {
  const hand = (score: number) => ({
    handedness: "Right" as const,
    score,
    landmarks: placeHand({ pose: "open", handedness: "Right", at: { x: 0.5, y: 0.5 }, size: 0.25 }, 16 / 9),
  });

  it("drops hands below the confidence threshold", () => {
    const engine = new GestureEngine({ minHandScore: 0.6 });
    expect(engine.process({ t: 0, hands: [hand(0.4)] }).hands).toHaveLength(0);
    expect(engine.process({ t: 33, hands: [hand(0.8)] }).hands).toHaveLength(1);
  });

  it("forgets a hand that left, so it re-enters without a stale gesture", () => {
    const engine = new GestureEngine();
    for (let t = 0; t <= 300; t += 33) engine.process({ t, hands: [hand(0.9)] });
    engine.process({ t: 333, hands: [] });
    expect(engine.process({ t: 366, hands: [hand(0.9)] }).hands[0].gesture).toBe("none");
  });
});

describe("resolveHandedness", () => {
  const at = (x: number, handedness: "Left" | "Right", score = 0.9) => ({
    handedness,
    score,
    landmarks: placeHand({ pose: "open", handedness, at: { x, y: 0.5 }, size: 0.2 }, 16 / 9),
  });

  it("keeps distinct labels as they are", () => {
    const hands = resolveHandedness([at(0.7, "Right"), at(0.3, "Left")]);
    expect(hands.map((h) => h.handedness).sort()).toEqual(["Left", "Right"]);
  });

  it("splits two hands with the same label by position in the mirrored view", () => {
    const [a, b] = resolveHandedness([at(0.75, "Left"), at(0.25, "Left")]);
    expect(a.handedness).toBe("Left");
    expect(b.handedness).toBe("Right");
    expect(a.landmarks[0].x).toBeLessThan(b.landmarks[0].x);
  });

  it("keeps only the two most confident hands", () => {
    const hands = resolveHandedness([at(0.2, "Left", 0.7), at(0.5, "Right", 0.95), at(0.8, "Right", 0.9)]);
    expect(hands).toHaveLength(2);
    expect(hands.every((h) => h.score >= 0.9)).toBe(true);
  });
});
