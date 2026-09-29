import { createHash, randomBytes } from "node:crypto";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { RealtimeTicketsRepository } from "../repositories/realtimeTickets.repository.js";

export interface IssuedRealtimeTicket {
  readonly ticket: string;
  readonly expiresAt: string;
}

function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}

export class RealtimeTicketService {
  public constructor(
    private readonly tickets: RealtimeTicketsRepository,
    private readonly clock: Clock,
    private readonly ticketLifetimeSeconds: number,
  ) {}

  public async issueTicket(principal: Principal): Promise<IssuedRealtimeTicket> {
    const now = this.clock.now();
    const ticket = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.ticketLifetimeSeconds * 1000);
    await this.tickets.saveTicket({ ticketHash: hashTicket(ticket), userId: principal.userId, sessionId: principal.sessionId, roles: principal.roles, expiresAt }, now);
    return { ticket, expiresAt: expiresAt.toISOString() };
  }

  public async redeemTicket(ticket: string): Promise<Principal | undefined> {
    const record = await this.tickets.consumeTicket(hashTicket(ticket), this.clock.now());
    return record === undefined ? undefined : { userId: record.userId, sessionId: record.sessionId, roles: record.roles };
  }

  public deleteExpiredTickets(): Promise<number> {
    return this.tickets.deleteExpiredTickets(this.clock.now());
  }
}
