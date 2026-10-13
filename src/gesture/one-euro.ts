/**
 * One Euro filter (Casiez, Roussel, Vogel, CHI 2012): an adaptive low-pass filter.
 * Slow movement gets a low cutoff (jitter disappears), fast movement raises the cutoff (lag stays small).
 */
export interface OneEuroParams {
  /** Cutoff in Hz when the signal is still. Lower means smoother and laggier. */
  minCutoff: number;
  /** How much the cutoff grows with speed. Higher means less lag on fast moves. */
  beta: number;
  /** Cutoff in Hz used to smooth the derivative itself. */
  dCutoff: number;
}

/** Tuned for landmarks normalised to [0, 1] at 30 to 60 Hz. */
export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.2, beta: 8, dCutoff: 1 };

function alpha(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT = 0;

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  /** Filters `value` sampled at `tMs`. The first sample passes through unchanged. */
  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.lastT = tMs;
      return value;
    }
    const dt = (tMs - this.lastT) / 1000;
    // Two samples with the same timestamp carry no new timing information.
    if (dt <= 0) return this.x;
    this.lastT = tMs;

    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.params.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}
