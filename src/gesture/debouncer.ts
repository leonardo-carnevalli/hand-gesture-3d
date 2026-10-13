import type { Classification } from "./classifier";
import type { Gesture } from "./types";

/**
 * A new gesture must be seen continuously for `holdMs` before it replaces the stable one.
 * A single misclassified frame in the middle of a grab therefore never drops the object.
 */
export class GestureDebouncer {
  private stable: Classification = { gesture: "none", confidence: 0 };
  private candidate: Gesture | null = null;
  private candidateSince = 0;

  constructor(private readonly holdMs = 90) {}

  get current(): Gesture {
    return this.stable.gesture;
  }

  update(next: Classification, tMs: number): Classification {
    if (next.gesture === this.stable.gesture) {
      this.candidate = null;
      this.stable = next;
      return next;
    }
    if (next.gesture !== this.candidate) {
      this.candidate = next.gesture;
      this.candidateSince = tMs;
    }
    if (tMs - this.candidateSince >= this.holdMs) {
      this.stable = next;
      this.candidate = null;
    }
    return this.stable;
  }
}
