import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./one-euro";
import { seededRandom } from "./synthetic";

const variance = (xs: number[]) => {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
};

describe("OneEuroFilter", () => {
  it("passes the first sample through unchanged", () => {
    expect(new OneEuroFilter().filter(0.42, 0)).toBe(0.42);
  });

  it("removes most of the jitter from a still hand", () => {
    const random = seededRandom(3);
    const filter = new OneEuroFilter();
    const raw: number[] = [];
    const smooth: number[] = [];
    for (let i = 0; i < 300; i++) {
      const value = 0.5 + (random() - 0.5) * 0.01;
      raw.push(value);
      smooth.push(filter.filter(value, i * (1000 / 30)));
    }
    expect(variance(smooth.slice(30))).toBeLessThan(variance(raw.slice(30)) * 0.25);
  });

  it("keeps up with a fast move: lag after a step is small", () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 0);
    let value = 0;
    for (let i = 1; i <= 6; i++) value = filter.filter(1, i * (1000 / 30));
    // 200 ms after a full-frame jump the output is most of the way there.
    expect(value).toBeGreaterThan(0.85);
  });

  it("smooths a slow move more than a fast one", () => {
    const run = (speed: number) => {
      const filter = new OneEuroFilter();
      let out = 0;
      for (let i = 0; i <= 30; i++) out = filter.filter(speed * i, i * (1000 / 30));
      return speed * 30 - out; // lag behind the true value
    };
    expect(run(0.002) / 0.002).toBeGreaterThan(run(0.05) / 0.05);
  });

  it("ignores a repeated timestamp instead of dividing by zero", () => {
    const filter = new OneEuroFilter();
    filter.filter(0.2, 10);
    expect(filter.filter(0.9, 10)).toBe(0.2);
  });
});
