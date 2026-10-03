export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { windowStartedAt: number; count: number }>();

  public constructor(private readonly now: () => number = Date.now) {}

  public async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    if (limit <= 0) return { allowed: true, retryAfterSeconds: 0 };
    const windowMs = windowSeconds * 1000;
    const moment = this.now();
    this.discardExpiredWindows(moment, windowMs);
    const current = this.windows.get(key);
    if (current === undefined || moment - current.windowStartedAt >= windowMs) {
      this.windows.set(key, { windowStartedAt: moment, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    if (current.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.windowStartedAt + windowMs - moment) / 1000)) };
  }

  private discardExpiredWindows(moment: number, windowMs: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) if (moment - window.windowStartedAt >= windowMs) this.windows.delete(key);
  }
}
