import type { RateLimitDecision, RateLimitStore } from "./rateLimitStore.service.js";
import type { ValkeyConnection } from "./valkeyConnection.service.js";

const incrementWithExpiryScript = "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; local t=redis.call('TTL',KEYS[1]); return {c,t}";
const circuitOpenMilliseconds = 5_000;

export class ValkeyRateLimitStore implements RateLimitStore {
  private circuitOpenUntil = 0;

  public constructor(
    private readonly connection: Pick<ValkeyConnection, "command">,
    private readonly fallback: RateLimitStore,
    private readonly onFailure: (error: unknown) => void = () => undefined,
    private readonly now: () => number = Date.now,
  ) {}

  public async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    if (limit <= 0) return { allowed: true, retryAfterSeconds: 0 };
    if (this.now() < this.circuitOpenUntil) return this.fallback.hit(key, limit, windowSeconds);
    try {
      const reply = await this.connection.command(["EVAL", incrementWithExpiryScript, 1, key, windowSeconds]);
      if (!Array.isArray(reply)) throw new Error("unexpected valkey reply");
      const count = Number(reply[0]);
      const ttl = Number(reply[1]);
      if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.max(1, ttl > 0 ? ttl : windowSeconds) };
    } catch (error) {
      this.circuitOpenUntil = this.now() + circuitOpenMilliseconds;
      this.onFailure(error);
      return this.fallback.hit(key, limit, windowSeconds);
    }
  }
}
