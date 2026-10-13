import { DEFAULT_ONE_EURO, OneEuroFilter, type OneEuroParams } from "./one-euro";
import type { Point3 } from "./types";

/** One Euro filter per coordinate of every landmark of a single hand. */
export class LandmarkSmoother {
  private filters: OneEuroFilter[] = [];

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  smooth(landmarks: Point3[], tMs: number): Point3[] {
    while (this.filters.length < landmarks.length * 3) {
      this.filters.push(new OneEuroFilter(this.params));
    }
    return landmarks.map((p, i) => ({
      x: this.filters[i * 3].filter(p.x, tMs),
      y: this.filters[i * 3 + 1].filter(p.y, tMs),
      z: this.filters[i * 3 + 2].filter(p.z, tMs),
    }));
  }
}
