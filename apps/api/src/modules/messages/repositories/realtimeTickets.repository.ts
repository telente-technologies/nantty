import { prisma } from "../../../integrations/database.integration.js";

export interface RealtimeTicketRecord {
  readonly ticketHash: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: readonly string[];
  readonly expiresAt: Date;
}

export interface RealtimeTicketsRepository {
  saveTicket(ticket: RealtimeTicketRecord, now: Date): Promise<void>;
  consumeTicket(ticketHash: string, now: Date): Promise<RealtimeTicketRecord | undefined>;
  deleteExpiredTickets(now: Date): Promise<number>;
}

export class InMemoryRealtimeTicketsRepository implements RealtimeTicketsRepository {
  private readonly tickets = new Map<string, RealtimeTicketRecord>();

  public async saveTicket(ticket: RealtimeTicketRecord): Promise<void> {
    this.tickets.set(ticket.ticketHash, ticket);
  }

  public async consumeTicket(ticketHash: string, now: Date): Promise<RealtimeTicketRecord | undefined> {
    const ticket = this.tickets.get(ticketHash);
    this.tickets.delete(ticketHash);
    return ticket !== undefined && ticket.expiresAt > now ? ticket : undefined;
  }

  public async deleteExpiredTickets(now: Date): Promise<number> {
    let deleted = 0;
    for (const [hash, ticket] of this.tickets) {
      if (ticket.expiresAt <= now) {
        this.tickets.delete(hash);
        deleted += 1;
      }
    }
    return deleted;
  }
}

export class PrismaRealtimeTicketsRepository implements RealtimeTicketsRepository {
  public async saveTicket(ticket: RealtimeTicketRecord, now: Date): Promise<void> {
    await prisma().realtimeTicket.create({ data: { ...ticket, roles: [...ticket.roles], createdAt: now } });
  }

  public async consumeTicket(ticketHash: string, now: Date): Promise<RealtimeTicketRecord | undefined> {
    const claimed = await prisma().realtimeTicket.updateMany({ where: { ticketHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count === 0) return undefined;
    return (await prisma().realtimeTicket.findUnique({ where: { ticketHash } })) ?? undefined;
  }

  public async deleteExpiredTickets(now: Date): Promise<number> {
    const result = await prisma().realtimeTicket.deleteMany({ where: { expiresAt: { lte: now } } });
    return result.count;
  }
}
