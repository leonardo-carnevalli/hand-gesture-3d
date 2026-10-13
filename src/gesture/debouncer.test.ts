import { describe, expect, it } from "vitest";
import { GestureDebouncer } from "./debouncer";

const c = (gesture: "open" | "fist" | "none", confidence = 0.9) => ({ gesture, confidence });

describe("GestureDebouncer", () => {
  it("switches only after the new gesture has held for the window", () => {
    const d = new GestureDebouncer(90);
    expect(d.update(c("open"), 0).gesture).toBe("none");
    expect(d.update(c("open"), 60).gesture).toBe("none");
    expect(d.update(c("open"), 90).gesture).toBe("open");
  });

  it("ignores a one-frame glitch in the middle of a gesture", () => {
    const d = new GestureDebouncer(90);
    d.update(c("fist"), 0);
    d.update(c("fist"), 100);
    expect(d.update(c("open"), 133).gesture).toBe("fist");
    expect(d.update(c("fist"), 166).gesture).toBe("fist");
    // The glitch did not leave a half-finished timer behind.
    expect(d.update(c("open"), 200).gesture).toBe("fist");
    expect(d.update(c("open"), 260).gesture).toBe("fist");
  });

  it("restarts the timer when the candidate changes", () => {
    const d = new GestureDebouncer(90);
    d.update(c("open"), 0);
    d.update(c("fist"), 60);
    expect(d.update(c("fist"), 120).gesture).toBe("none");
    expect(d.update(c("fist"), 150).gesture).toBe("fist");
  });

  it("keeps the stable gesture's confidence while a change is pending", () => {
    const d = new GestureDebouncer(90);
    d.update(c("open", 0.8), 0);
    d.update(c("open", 0.8), 100);
    expect(d.update(c("fist", 0.99), 120)).toEqual({ gesture: "open", confidence: 0.8 });
  });
});
