import { describe, expect, it } from "vitest";
import { loadFixture } from "../../fixtures/load";
import { ActionMapper, wrapAngle, type Action } from "./actions";
import { GestureEngine } from "./engine";
import type { Recording } from "./recording";
import type { EngineOutput, Gesture, Handedness, TrackedHand } from "./types";

const tracked = (gesture: Gesture, x: number, y: number, handedness: Handedness = "Right"): TrackedHand => ({
  handedness,
  gesture,
  confidence: 0.9,
  landmarks: [],
  pointer: { x, y },
});
const out = (t: number, ...hands: TrackedHand[]): EngineOutput => ({ t, hands });
const ofType = <T extends Action["type"]>(actions: Action[], type: T) =>
  actions.filter((a): a is Extract<Action, { type: T }> => a.type === type);

function replay(recording: Recording): Action[] {
  const engine = new GestureEngine({ aspect: recording.aspect });
  const mapper = new ActionMapper({ aspect: recording.aspect });
  return recording.frames.flatMap((f) => mapper.update(engine.process(f)));
}

describe("ActionMapper", () => {
  it("point hovers at the fingertip every frame", () => {
    const m = new ActionMapper();
    expect(m.update(out(0, tracked("point", 0.2, 0.3)))).toEqual([{ type: "hover", x: 0.2, y: 0.3 }]);
  });

  it("pinch selects once, on the transition, then only hovers", () => {
    const m = new ActionMapper();
    m.update(out(0, tracked("open", 0.5, 0.5)));
    expect(ofType(m.update(out(33, tracked("pinch", 0.5, 0.5))), "select")).toHaveLength(1);
    expect(ofType(m.update(out(66, tracked("pinch", 0.5, 0.5))), "select")).toHaveLength(0);
  });

  it("a fist rotates by how far the hand moved, starting from the second frame", () => {
    const m = new ActionMapper({ rotateGain: 2 });
    expect(m.update(out(0, tracked("fist", 0.5, 0.5)))).toEqual([]);
    const [rotate] = ofType(m.update(out(33, tracked("fist", 0.6, 0.45))), "rotate");
    expect(rotate.yaw).toBeCloseTo(0.2);
    expect(rotate.pitch).toBeCloseTo(-0.1);
  });

  it("an open palm resets once after being held, not before", () => {
    const m = new ActionMapper({ resetHoldMs: 800 });
    const resets: number[] = [];
    for (let t = 0; t <= 2000; t += 33) {
      if (ofType(m.update(out(t, tracked("open", 0.5, 0.5))), "reset").length) resets.push(t);
    }
    expect(resets).toHaveLength(1);
    expect(resets[0]).toBeGreaterThanOrEqual(800);
  });

  it("a brief open palm between gestures does not reset", () => {
    const m = new ActionMapper({ resetHoldMs: 800 });
    const actions = [0, 33, 66, 100, 133].flatMap((t) => m.update(out(t, tracked(t < 100 ? "open" : "fist", 0.5, 0.5))));
    expect(ofType(actions, "reset")).toHaveLength(0);
  });

  it("two pinching hands scale by the change in distance and roll by the change in angle", () => {
    const m = new ActionMapper({ aspect: 1 });
    m.update(out(0, tracked("pinch", 0.4, 0.5, "Left"), tracked("pinch", 0.6, 0.5, "Right")));
    const actions = m.update(out(33, tracked("pinch", 0.3, 0.5, "Left"), tracked("pinch", 0.7, 0.5, "Right")));
    expect(ofType(actions, "scale")[0].factor).toBeCloseTo(2);
    expect(ofType(actions, "roll")[0].radians).toBeCloseTo(0);
    expect(ofType(actions, "select")).toHaveLength(0);

    const tilted = m.update(out(66, tracked("pinch", 0.3, 0.3, "Left"), tracked("pinch", 0.7, 0.7, "Right")));
    expect(ofType(tilted, "roll")[0].radians).toBeCloseTo(Math.PI / 4);
  });

  it("orders the two hands by handedness, so crossing them reads as a half turn and not as noise", () => {
    const m = new ActionMapper({ aspect: 1 });
    m.update(out(0, tracked("pinch", 0.45, 0.5, "Left"), tracked("pinch", 0.55, 0.5, "Right")));
    const actions = m.update(out(33, tracked("pinch", 0.45, 0.49, "Left"), tracked("pinch", 0.55, 0.51, "Right")));
    expect(ofType(actions, "roll")[0].radians).toBeGreaterThan(0);
  });

  it("wrapAngle takes the short way round", () => {
    expect(wrapAngle(2 * Math.PI - 0.1)).toBeCloseTo(-0.1);
    expect(wrapAngle(-2 * Math.PI + 0.1)).toBeCloseTo(0.1);
  });
});

describe("ActionMapper on fixtures", () => {
  it("pinch-select emits exactly one select, at the pinch point", () => {
    const selects = ofType(replay(loadFixture("pinch-select")), "select");
    expect(selects).toHaveLength(1);
    expect(selects[0].x).toBeCloseTo(0.5, 1);
    expect(selects[0].y).toBeCloseTo(0.5, 1);
  });

  it("fist-drag yaws to the right with almost no pitch", () => {
    const rotations = ofType(replay(loadFixture("fist-drag")), "rotate");
    const yaw = rotations.reduce((s, r) => s + r.yaw, 0);
    const pitch = rotations.reduce((s, r) => s + r.pitch, 0);
    expect(yaw).toBeGreaterThan(1.5);
    expect(Math.abs(pitch)).toBeLessThan(0.05);
  });

  it("two-hand-zoom scales up", () => {
    const total = ofType(replay(loadFixture("two-hand-zoom")), "scale").reduce((s, a) => s * a.factor, 1);
    expect(total).toBeGreaterThan(2);
  });

  it("open-hold resets exactly once", () => {
    expect(ofType(replay(loadFixture("open-hold")), "reset")).toHaveLength(1);
  });

  it("the noisy demo tells the whole story: hover, select, rotate, scale, roll and one reset", () => {
    const actions = replay(loadFixture("demo-noisy"));
    for (const type of ["hover", "select", "rotate", "scale", "roll"] as const) {
      expect(ofType(actions, type).length, type).toBeGreaterThan(0);
    }
    expect(ofType(actions, "reset")).toHaveLength(1);
  });
});
