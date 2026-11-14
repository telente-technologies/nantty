import { decideSlidingWindow, locateSlidingWindow, type RateLimitDecision, type RateLimitStore } from "./rateLimitStore.service.js";
import type { ValkeyConnection } from "./valkeyConnection.service.js";

const slidingWindowScript = "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local p=tonumber(redis.call('GET',KEYS[2]) or '0'); return {c,p}";
const circuitOpenMilliseconds = 5_000;

export class ValkeyRateLimitStore implements RateLimitStore {
  private circuitOpenUntil = 0;

  public constructor(
    private readonly connection: Pick<ValkeyConnection, "command">,
    private readonly onFailure: (error: unknown) => void = () => undefined,
    private readonly now: () => number = Date.now,
  ) {}

  public async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    if (limit <= 0) return { allowed: true, retryAfterSeconds: 0 };
    const moment = this.now();
    if (moment < this.circuitOpenUntil) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((this.circuitOpenUntil - moment) / 1000)) };
    const position = locateSlidingWindow(moment, windowSeconds);
    try {
      const reply = await this.connection.command(["EVAL", slidingWindowScript, 2, `{${key}}:${position.index}`, `{${key}}:${position.index - 1}`, windowSeconds * 2000]);
      if (!Array.isArray(reply)) throw new Error("unexpected valkey reply");
      return decideSlidingWindow(Number(reply[0]), Number(reply[1]), limit, position);
    } catch (error) {
      this.circuitOpenUntil = moment + circuitOpenMilliseconds;
      this.onFailure(error);
      return { allowed: false, retryAfterSeconds: Math.ceil(circuitOpenMilliseconds / 1000) };
    }
  }
}
