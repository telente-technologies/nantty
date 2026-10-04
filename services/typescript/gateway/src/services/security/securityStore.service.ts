import type { ValkeyConnection } from "../valkeyConnection.service.js";

export interface SecurityStore {
  recordInWindow(key: string, member: string, windowSeconds: number): Promise<number>;
  claimOnce(key: string, ttlSeconds: number): Promise<boolean>;
  put(key: string, ttlSeconds: number): Promise<void>;
  take(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

const maximumMembersPerWindow = 1000;

export class InMemorySecurityStore implements SecurityStore {
  private readonly windows = new Map<string, Map<string, number>>();
  private readonly flags = new Map<string, number>();

  public constructor(private readonly now: () => number = Date.now) {}

  public async recordInWindow(key: string, member: string, windowSeconds: number): Promise<number> {
    const moment = this.now();
    const window = this.windows.get(key) ?? new Map<string, number>();
    for (const [existing, seenAt] of window) if (seenAt <= moment - windowSeconds * 1000) window.delete(existing);
    window.set(member, moment);
    while (window.size > maximumMembersPerWindow) window.delete(window.keys().next().value as string);
    this.windows.set(key, window);
    if (this.windows.size > 50_000) this.windows.clear();
    return window.size;
  }

  public async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    if (await this.has(key)) return false;
    await this.put(key, ttlSeconds);
    return true;
  }

  public async put(key: string, ttlSeconds: number): Promise<void> {
    if (this.flags.size > 50_000) this.flags.clear();
    this.flags.set(key, this.now() + ttlSeconds * 1000);
  }

  public async take(key: string): Promise<boolean> {
    const present = await this.has(key);
    this.flags.delete(key);
    return present;
  }

  public async has(key: string): Promise<boolean> {
    const expiresAt = this.flags.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt > this.now()) return true;
    this.flags.delete(key);
    return false;
  }
}

const recordInWindowScript = [
  "local now=tonumber(ARGV[1]) local window=tonumber(ARGV[2])",
  "redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now-window)",
  "redis.call('ZADD',KEYS[1],now,ARGV[3])",
  `redis.call('ZREMRANGEBYRANK',KEYS[1],0,-${maximumMembersPerWindow + 1})`,
  "redis.call('PEXPIRE',KEYS[1],window)",
  "return redis.call('ZCARD',KEYS[1])",
].join(" ");

export class ValkeySecurityStore implements SecurityStore {
  private circuitOpenUntil = 0;

  public constructor(
    private readonly connection: Pick<ValkeyConnection, "command">,
    private readonly fallback: SecurityStore,
    private readonly onFailure: (error: unknown) => void = () => undefined,
    private readonly now: () => number = Date.now,
  ) {}

  public recordInWindow(key: string, member: string, windowSeconds: number): Promise<number> {
    return this.run(async () => Number(await this.connection.command(["EVAL", recordInWindowScript, 1, key, this.now(), windowSeconds * 1000, member])), () => this.fallback.recordInWindow(key, member, windowSeconds));
  }

  public claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
    return this.run(async () => (await this.connection.command(["SET", key, "1", "NX", "EX", ttlSeconds])) === "OK", () => this.fallback.claimOnce(key, ttlSeconds));
  }

  public put(key: string, ttlSeconds: number): Promise<void> {
    return this.run(async () => { await this.connection.command(["SET", key, "1", "EX", ttlSeconds]); }, () => this.fallback.put(key, ttlSeconds));
  }

  public take(key: string): Promise<boolean> {
    return this.run(async () => Number(await this.connection.command(["DEL", key])) === 1, () => this.fallback.take(key));
  }

  public has(key: string): Promise<boolean> {
    return this.run(async () => Number(await this.connection.command(["EXISTS", key])) === 1, () => this.fallback.has(key));
  }

  private async run<Result>(work: () => Promise<Result>, fallback: () => Promise<Result>): Promise<Result> {
    if (this.now() < this.circuitOpenUntil) return fallback();
    try {
      return await work();
    } catch (error) {
      this.circuitOpenUntil = this.now() + 5_000;
      this.onFailure(error);
      return fallback();
    }
  }
}
