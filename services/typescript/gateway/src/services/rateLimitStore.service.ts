export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export interface SlidingWindowPosition {
  readonly index: number;
  readonly elapsedFraction: number;
  readonly secondsUntilNextWindow: number;
}

export function locateSlidingWindow(moment: number, windowSeconds: number): SlidingWindowPosition {
  const windowMs = windowSeconds * 1000;
  const index = Math.floor(moment / windowMs);
  const elapsed = moment - index * windowMs;
  return { index, elapsedFraction: elapsed / windowMs, secondsUntilNextWindow: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)) };
}

export function decideSlidingWindow(current: number, previous: number, limit: number, position: SlidingWindowPosition): RateLimitDecision {
  const estimated = current + previous * (1 - position.elapsedFraction);
  if (estimated <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: position.secondsUntilNextWindow };
}

const maximumTrackedKeys = 50_000;

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { index: number; current: number; previous: number }>();

  public constructor(private readonly now: () => number = Date.now) {}

  public async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    if (limit <= 0) return { allowed: true, retryAfterSeconds: 0 };
    const position = locateSlidingWindow(this.now(), windowSeconds);
    const stored = this.windows.get(key);
    const entry = stored === undefined || stored.index < position.index - 1
      ? { index: position.index, current: 0, previous: 0 }
      : stored.index === position.index - 1 ? { index: position.index, current: 0, previous: stored.current } : stored;
    entry.current += 1;
    this.windows.delete(key);
    while (this.windows.size >= maximumTrackedKeys) this.windows.delete(this.windows.keys().next().value as string);
    this.windows.set(key, entry);
    return decideSlidingWindow(entry.current, entry.previous, limit, position);
  }
}
