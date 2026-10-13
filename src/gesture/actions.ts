import type { EngineOutput, Gesture, Handedness, TrackedHand } from "./types";

/** What the scene is asked to do. Mouse, touch and hands all speak this one vocabulary. */
export type Action =
  | { type: "hover"; x: number; y: number }
  | { type: "select"; x: number; y: number }
  | { type: "rotate"; yaw: number; pitch: number }
  | { type: "scale"; factor: number }
  /** Screen-space roll, clockwise positive (y points down). */
  | { type: "roll"; radians: number }
  | { type: "reset" };

export interface MapperOptions {
  aspect: number;
  /** Radians of rotation for a hand travelling the full width of the frame. */
  rotateGain: number;
  /** How long an open palm must be held before the scene resets. */
  resetHoldMs: number;
}

export const DEFAULT_MAPPER_OPTIONS: MapperOptions = {
  aspect: 16 / 9,
  rotateGain: 2 * Math.PI,
  resetHoldMs: 800,
};

interface HandMemory {
  gesture: Gesture;
  x: number;
  y: number;
  since: number;
  resetFired: boolean;
}

interface TwoHandMemory {
  distance: number;
  angle: number;
}

/** Wraps an angle difference into (-PI, PI] so crossing the atan2 seam is not a full turn. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Turns the per-frame engine output into discrete scene actions, using gesture transitions. */
export class ActionMapper {
  private readonly options: MapperOptions;
  private hands = new Map<Handedness, HandMemory>();
  private twoHand: TwoHandMemory | null = null;

  constructor(options: Partial<MapperOptions> = {}) {
    this.options = { ...DEFAULT_MAPPER_OPTIONS, ...options };
  }

  update(out: EngineOutput): Action[] {
    const twoHandPinch = out.hands.length === 2 && out.hands.every((h) => h.gesture === "pinch");
    const actions = twoHandPinch ? this.twoHandActions(out.hands) : out.hands.flatMap((h) => this.handActions(h, out.t));
    if (!twoHandPinch) this.twoHand = null;

    const next = new Map<Handedness, HandMemory>();
    for (const hand of out.hands) {
      const before = this.hands.get(hand.handedness);
      const same = before?.gesture === hand.gesture;
      next.set(hand.handedness, {
        gesture: hand.gesture,
        x: hand.pointer.x,
        y: hand.pointer.y,
        since: same ? before.since : out.t,
        resetFired: same ? before.resetFired || this.resetDue(before, out.t) : false,
      });
    }
    this.hands = next;
    return actions;
  }

  private resetDue(memory: HandMemory, t: number): boolean {
    return memory.gesture === "open" && !memory.resetFired && t - memory.since >= this.options.resetHoldMs;
  }

  private handActions(hand: TrackedHand, t: number): Action[] {
    const before = this.hands.get(hand.handedness);
    const { x, y } = hand.pointer;
    switch (hand.gesture) {
      case "point":
        return [{ type: "hover", x, y }];
      case "pinch":
        return before?.gesture === "pinch"
          ? [{ type: "hover", x, y }]
          : [
              { type: "hover", x, y },
              { type: "select", x, y },
            ];
      case "fist":
        if (before?.gesture !== "fist") return [];
        return [
          {
            type: "rotate",
            yaw: (x - before.x) * this.options.rotateGain,
            pitch: (y - before.y) * this.options.rotateGain,
          },
        ];
      case "open":
        return before?.gesture === "open" && this.resetDue(before, t) ? [{ type: "reset" }] : [];
      default:
        return [];
    }
  }

  private twoHandActions(hands: TrackedHand[]): Action[] {
    // Ordered by handedness, not by position, so crossing the hands never flips the angle by half a turn.
    const [a, b] = [...hands].sort((h1, h2) => h1.handedness.localeCompare(h2.handedness)).map((h) => h.pointer);
    const dx = (b.x - a.x) * this.options.aspect;
    const dy = b.y - a.y;
    const current = { distance: Math.max(Math.hypot(dx, dy), 1e-6), angle: Math.atan2(dy, dx) };
    const before = this.twoHand;
    this.twoHand = current;
    if (!before) return [];
    return [
      { type: "scale", factor: current.distance / before.distance },
      { type: "roll", radians: wrapAngle(current.angle - before.angle) },
    ];
  }
}
