export interface FrameMetricSnapshot {
  readonly samples: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly worstMs: number;
  readonly hitchesOver33Ms: number;
  readonly hitchesOver50Ms: number;
  readonly hitchesOver100Ms: number;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export class FrameMetrics {
  private readonly values: number[] = [];
  private warmupFrames: number;

  constructor(
    warmupFrames = 60,
    private readonly maxSamples = 3_600,
  ) {
    this.warmupFrames = warmupFrames;
  }

  add(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    if (this.warmupFrames > 0) {
      this.warmupFrames -= 1;
      return;
    }
    this.values.push(deltaMs);
    if (this.values.length > this.maxSamples) this.values.shift();
  }

  reset(warmupFrames = 0): void {
    this.values.length = 0;
    this.warmupFrames = warmupFrames;
  }

  snapshot(): FrameMetricSnapshot {
    const sorted = [...this.values].sort((a, b) => a - b);
    return Object.freeze({
      samples: sorted.length,
      p50Ms: rounded(percentile(sorted, 0.5)),
      p95Ms: rounded(percentile(sorted, 0.95)),
      p99Ms: rounded(percentile(sorted, 0.99)),
      worstMs: rounded(sorted.at(-1) ?? 0),
      hitchesOver33Ms: sorted.filter((value) => value > 33).length,
      hitchesOver50Ms: sorted.filter((value) => value > 50).length,
      hitchesOver100Ms: sorted.filter((value) => value > 100).length,
    });
  }
}
