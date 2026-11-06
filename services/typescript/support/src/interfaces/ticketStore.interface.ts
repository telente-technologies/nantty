import type { DomainEventInput } from "../events/outbox.event.js";
import type { AgentRecord, MacroRecord, NewHistoryEntry, NewTicket, NewTicketMessage, TicketMessageRecord, TicketQueueFilter, TicketRecord, TicketUpdate, TicketWithThread } from "../types/ticket.type.js";
import type { TicketCategory } from "../enums/ticket.enum.js";

export interface TicketWrite {
  readonly update?: TicketUpdate;
  readonly message?: NewTicketMessage;
  readonly history?: NewHistoryEntry;
  readonly events?: readonly DomainEventInput[];
}

export interface TicketStore {
  createTicket(ticket: NewTicket, firstMessage: NewTicketMessage, buildEvents: (created: TicketRecord) => readonly DomainEventInput[]): Promise<TicketWithThread>;
  findTicketByIdempotencyKey(accountId: string, key: string): Promise<TicketWithThread | null>;
  findMessageByIdempotencyKey(ticketId: string, authorId: string, key: string): Promise<TicketMessageRecord | null>;
  findTicket(ticketId: string): Promise<TicketWithThread | null>;
  findTicketByNumber(number: number): Promise<TicketWithThread | null>;
  listTicketsForRequester(accountId: string): Promise<readonly TicketRecord[]>;
  listTicketQueue(filter: TicketQueueFilter): Promise<{ readonly items: readonly TicketRecord[]; readonly total: number }>;
  writeTicket(ticketId: string, write: TicketWrite): Promise<TicketWithThread>;
  countRequesterUnread(accountId: string): Promise<number>;
  claimTicketsQueuedForAutoFaq(limit: number, now: Date, lockMilliseconds: number): Promise<readonly TicketWithThread[]>;
  setAutoFaqStatus(ticketId: string, status: TicketRecord["autoFaqStatus"]): Promise<void>;
  closeResolvedTicketsBefore(cutoff: Date, now: Date): Promise<number>;
  anonymizeRequester(accountId: string, now: Date): Promise<number>;
  listMacros(): Promise<readonly MacroRecord[]>;
  createMacro(input: { readonly title: string; readonly body: string; readonly category: TicketCategory | null; readonly updatedByName: string }): Promise<MacroRecord>;
  updateMacro(macroId: string, input: { readonly title: string; readonly body: string; readonly category: TicketCategory | null; readonly updatedByName: string }): Promise<MacroRecord | null>;
  deleteMacro(macroId: string): Promise<boolean>;
  recordAgentSeen(agent: AgentRecord, now: Date): Promise<void>;
  listAgentsSeenSince(since: Date): Promise<readonly AgentRecord[]>;
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string, eventType: string): Promise<void>;
}
