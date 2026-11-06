import { randomUUID } from "node:crypto";

import type { DomainEventInput } from "../../src/events/outbox.event.js";
import type { TicketStore } from "../../src/interfaces/ticketStore.interface.js";
import type { AgentRecord, MacroRecord, NewHistoryEntry, NewTicketMessage, TicketRecord, TicketWithThread } from "../../src/types/ticket.type.js";

type MutableTicket = { -readonly [Key in keyof TicketWithThread]: TicketWithThread[Key] } & { idempotencyKey: string | null; lockedUntil: Date | null };

export class InMemoryTicketStore implements TicketStore {
  public readonly tickets = new Map<string, MutableTicket>();
  public readonly events: DomainEventInput[] = [];
  public readonly macros = new Map<string, MacroRecord>();
  public readonly agents = new Map<string, AgentRecord & { lastSeenAt: Date }>();
  public readonly processed = new Set<string>();
  private nextNumber = 10_000;

  public constructor(private readonly now: () => Date) {}

  private snapshot(ticket: MutableTicket): TicketWithThread {
    const { idempotencyKey: _key, lockedUntil: _lock, ...rest } = ticket;
    return structuredClone(rest);
  }

  private toMessage(ticketId: string, message: NewTicketMessage) {
    return { id: randomUUID(), ticketId, ...message, idempotencyKey: message.idempotencyKey ?? null, createdAt: this.now() };
  }

  private toHistory(entry: NewHistoryEntry) {
    return { id: randomUUID(), action: entry.action, actorId: entry.actorId, actorName: entry.actorName, reason: entry.reason ?? null, detail: entry.detail ?? {}, createdAt: this.now() };
  }

  public async createTicket(...[ticket, firstMessage, buildEvents]: Parameters<TicketStore["createTicket"]>) {
    const id = randomUUID();
    const now = this.now();
    const record: MutableTicket = {
      ...ticket, id, number: (this.nextNumber += 1), status: "open", assigneeStaffId: null, assigneeName: null, firstRespondedAt: null, resolvedAt: null, closedAt: null,
      satisfactionScore: null, satisfactionComment: null, lastMessageAt: now, lastMessagePreview: firstMessage.body.slice(0, 140), requesterUnread: 0, messageCount: 1, autoFaqStatus: "none",
      createdAt: now, updatedAt: now, messages: [this.toMessage(id, firstMessage)], history: [this.toHistory({ action: "support.ticket_created", actorId: ticket.requesterAccountId, actorName: ticket.requesterName })], lockedUntil: null,
    };
    this.tickets.set(id, record);
    this.events.push(...buildEvents(this.snapshot(record)));
    return this.snapshot(record);
  }

  public async findTicketByIdempotencyKey(accountId: string, key: string) {
    const found = [...this.tickets.values()].find((ticket) => ticket.requesterAccountId === accountId && ticket.idempotencyKey === key);
    return found === undefined ? null : this.snapshot(found);
  }

  public async findMessageByIdempotencyKey(ticketId: string, authorId: string, key: string) {
    const ticket = this.tickets.get(ticketId);
    return structuredClone(ticket?.messages.find((message) => message.authorId === authorId && message.idempotencyKey === key) ?? null);
  }

  public async findTicket(ticketId: string) {
    const found = this.tickets.get(ticketId);
    return found === undefined ? null : this.snapshot(found);
  }

  public async findTicketByNumber(number: number) {
    const found = [...this.tickets.values()].find((ticket) => ticket.number === number);
    return found === undefined ? null : this.snapshot(found);
  }

  public async listTicketsForRequester(accountId: string) {
    return [...this.tickets.values()].filter((ticket) => ticket.requesterAccountId === accountId).map((ticket) => this.snapshot(ticket) as TicketRecord);
  }

  public async listTicketQueue(filter: Parameters<TicketStore["listTicketQueue"]>[0]) {
    const items = [...this.tickets.values()].filter((ticket) =>
      (filter.statuses === undefined || filter.statuses.includes(ticket.status)) && (filter.channel === undefined || ticket.channel === filter.channel)
      && (filter.assignee.kind === "all" || (filter.assignee.kind === "unassigned" ? ticket.assigneeStaffId === null : ticket.assigneeStaffId === filter.assignee.staffId)));
    return { items: items.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize).map((ticket) => this.snapshot(ticket)), total: items.length };
  }

  public async writeTicket(ticketId: string, write: Parameters<TicketStore["writeTicket"]>[1]) {
    const ticket = this.tickets.get(ticketId);
    if (ticket === undefined) throw new Error("ticket not found");
    if (write.message !== undefined) ticket.messages = [...ticket.messages, this.toMessage(ticketId, write.message)];
    if (write.history !== undefined) ticket.history = [...ticket.history, this.toHistory(write.history)];
    if (write.update !== undefined) {
      const { requesterUnreadIncrement, resetRequesterUnread, messageCountIncrement, ...fields } = write.update;
      Object.assign(ticket, fields);
      if (resetRequesterUnread === true) ticket.requesterUnread = 0;
      else if (requesterUnreadIncrement !== undefined) ticket.requesterUnread += requesterUnreadIncrement;
      if (messageCountIncrement !== undefined) ticket.messageCount += messageCountIncrement;
    }
    ticket.updatedAt = this.now();
    this.events.push(...(write.events ?? []));
    return this.snapshot(ticket);
  }

  public async countRequesterUnread(accountId: string) {
    return [...this.tickets.values()].filter((ticket) => ticket.requesterAccountId === accountId).reduce((sum, ticket) => sum + ticket.requesterUnread, 0);
  }

  public async claimTicketsQueuedForAutoFaq(limit: number, now: Date, lockMilliseconds: number) {
    const queued = [...this.tickets.values()].filter((ticket) => ticket.autoFaqStatus === "queued" && (ticket.lockedUntil === null || ticket.lockedUntil < now)).slice(0, limit);
    for (const ticket of queued) ticket.lockedUntil = new Date(now.getTime() + lockMilliseconds);
    return queued.map((ticket) => this.snapshot(ticket));
  }

  public async setAutoFaqStatus(ticketId: string, status: TicketRecord["autoFaqStatus"]) {
    const ticket = this.tickets.get(ticketId);
    if (ticket !== undefined) Object.assign(ticket, { autoFaqStatus: status, lockedUntil: null });
  }

  public async closeResolvedTicketsBefore(cutoff: Date, now: Date) {
    let closed = 0;
    for (const ticket of this.tickets.values()) {
      if (ticket.status !== "resolved" || ticket.resolvedAt === null || ticket.resolvedAt >= cutoff) continue;
      Object.assign(ticket, { status: "closed", closedAt: now });
      closed += 1;
    }
    return closed;
  }

  public async anonymizeRequester(accountId: string) {
    let count = 0;
    for (const ticket of this.tickets.values()) {
      if (ticket.requesterAccountId !== accountId) continue;
      count += 1;
      Object.assign(ticket, { requesterName: "Deleted user", requesterUsername: "", subject: "Ticket from a deleted account" });
      ticket.messages = ticket.messages.map((message) => (message.authorKind === "customer" ? { ...message, body: "[removed after account deletion]", authorName: "Deleted user" } : message));
    }
    return count;
  }

  public async listMacros() {
    return [...this.macros.values()];
  }

  public async createMacro(input: Parameters<TicketStore["createMacro"]>[0]) {
    const macro = { id: randomUUID(), ...input, updatedAt: this.now() };
    this.macros.set(macro.id, macro);
    return macro;
  }

  public async updateMacro(macroId: string, input: Parameters<TicketStore["updateMacro"]>[1]) {
    if (!this.macros.has(macroId)) return null;
    const macro = { id: macroId, ...input, updatedAt: this.now() };
    this.macros.set(macroId, macro);
    return macro;
  }

  public async deleteMacro(macroId: string) {
    return this.macros.delete(macroId);
  }

  public async recordAgentSeen(agent: AgentRecord, now: Date) {
    this.agents.set(agent.staffId, { ...agent, lastSeenAt: now });
  }

  public async listAgentsSeenSince(since: Date) {
    return [...this.agents.values()].filter((agent) => agent.lastSeenAt >= since).map(({ staffId, name }) => ({ staffId, name }));
  }

  public async hasProcessedEvent(eventId: string) {
    return this.processed.has(eventId);
  }

  public async markEventProcessed(eventId: string) {
    this.processed.add(eventId);
  }
}
