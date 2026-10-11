interface CachedWidgetPayload<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export class WidgetResponseCache<T> {
  private readonly entries = new Map<string, CachedWidgetPayload<T>>();

  public constructor(private readonly timeToLiveMs = 45_000, private readonly maxEntries = 20_000, private readonly now: () => number = () => Date.now()) {}

  public async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const moment = this.now();
    const cached = this.entries.get(key);
    if (cached !== undefined && cached.expiresAt > moment) return cached.value;
    const value = await load();
    if (this.entries.size >= this.maxEntries) this.evict(moment);
    this.entries.set(key, { value, expiresAt: moment + this.timeToLiveMs });
    return value;
  }

  public get size(): number {
    return this.entries.size;
  }

  private evict(moment: number): void {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= moment) this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.entries.clear();
  }
}
