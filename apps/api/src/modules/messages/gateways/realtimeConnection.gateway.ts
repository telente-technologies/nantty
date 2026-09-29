import type { Principal } from "../../../interfaces/principal.interface.js";

export const CLOSE_CODES = {
  unauthenticated: 4401,
  forbidden: 4403,
  tooManyMessages: 4429,
  replacedByNewerConnection: 4409,
  slowConsumer: 1013,
  heartbeatMissed: 4408,
  goingAway: 1001,
} as const;

export interface RealtimeSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
  countBufferedBytes(): number;
  sendPing(): void;
}

export type ConnectionState = "awaiting_authentication" | "authenticating" | "open" | "closed";

export class RealtimeConnection {
  public state: ConnectionState = "awaiting_authentication";
  public principal: Principal | undefined;
  public lastActivityAt: number;
  private readonly recentMessageTimes: number[] = [];

  public constructor(
    public readonly id: number,
    public readonly socket: RealtimeSocket,
    public readonly openedAt: number,
  ) {
    this.lastActivityAt = openedAt;
  }

  public recordIncomingMessage(now: number, windowMs: number, maximumMessages: number): boolean {
    this.lastActivityAt = now;
    while (this.recentMessageTimes.length > 0 && (this.recentMessageTimes[0] ?? now) <= now - windowMs) this.recentMessageTimes.shift();
    this.recentMessageTimes.push(now);
    return this.recentMessageTimes.length <= maximumMessages;
  }

  public markAlive(now: number): void {
    this.lastActivityAt = now;
  }

  public close(code: number, reason: string): void {
    if (this.state === "closed") return;
    this.state = "closed";
    try {
      this.socket.close(code, reason);
    } catch {
      return;
    }
  }
}
