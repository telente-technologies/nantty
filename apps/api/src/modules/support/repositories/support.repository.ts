import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  MESSAGE_PREVIEW_LENGTH,
  type ContactRequestRecord,
  type NewContactRequest,
  type NewSupportMessage,
  type NewSupportTicket,
  type SupportMessageRecord,
  type SupportTicketChanges,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from "../models/support.model.js";

export interface SupportTicketsRepository {
  createTicket(ticket: NewSupportTicket, firstMessage: Omit<NewSupportMessage, "ticketId">, now: Date): Promise<SupportTicketRecord>;
  findTicket(ticketId: string): Promise<SupportTicketRecord | undefined>;
  listTicketsForRequester(requesterId: string, limit: number): Promise<readonly SupportTicketRecord[]>;
  listTickets(status: SupportTicketStatus | undefined, page: PageRequest): Promise<Page<SupportTicketRecord>>;
  appendMessage(message: NewSupportMessage, ticketChanges: SupportTicketChanges, now: Date): Promise<SupportMessageRecord>;
  updateTicket(ticketId: string, changes: SupportTicketChanges, now: Date): Promise<SupportTicketRecord | undefined>;
  listMessages(ticketId: string): Promise<readonly SupportMessageRecord[]>;
}

export interface ContactRequestsRepository {
  createContactRequest(request: NewContactRequest, now: Date): Promise<ContactRequestRecord>;
}

function sortByLatestUpdate(tickets: readonly SupportTicketRecord[]): SupportTicketRecord[] {
  return [...tickets].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id));
}

export class InMemorySupportTicketsRepository implements SupportTicketsRepository {
  private readonly tickets = new Map<string, SupportTicketRecord>();
  private readonly messages: SupportMessageRecord[] = [];

  public async createTicket(ticket: NewSupportTicket, firstMessage: Omit<NewSupportMessage, "ticketId">, now: Date): Promise<SupportTicketRecord> {
    const record: SupportTicketRecord = { ...ticket, id: randomUUID(), status: "open", assigneeId: null, lastMessagePreview: "", createdAt: now, updatedAt: now };
    this.tickets.set(record.id, record);
    await this.appendMessage({ ...firstMessage, ticketId: record.id }, { lastMessagePreview: firstMessage.text.slice(0, MESSAGE_PREVIEW_LENGTH) }, now);
    return this.tickets.get(record.id) ?? record;
  }

  public async findTicket(ticketId: string): Promise<SupportTicketRecord | undefined> {
    return this.tickets.get(ticketId);
  }

  public async listTicketsForRequester(requesterId: string, limit: number): Promise<readonly SupportTicketRecord[]> {
    return sortByLatestUpdate([...this.tickets.values()].filter((ticket) => ticket.requesterId === requesterId)).slice(0, limit);
  }

  public async listTickets(status: SupportTicketStatus | undefined, page: PageRequest): Promise<Page<SupportTicketRecord>> {
    return paginateSortedItems(sortByLatestUpdate([...this.tickets.values()].filter((ticket) => status === undefined || ticket.status === status)), page);
  }

  public async appendMessage(message: NewSupportMessage, ticketChanges: SupportTicketChanges, now: Date): Promise<SupportMessageRecord> {
    const record: SupportMessageRecord = { ...message, id: randomUUID(), createdAt: now };
    this.messages.push(record);
    await this.updateTicket(message.ticketId, ticketChanges, now);
    return record;
  }

  public async updateTicket(ticketId: string, changes: SupportTicketChanges, now: Date): Promise<SupportTicketRecord | undefined> {
    const existing = this.tickets.get(ticketId);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...changes, updatedAt: now };
    this.tickets.set(ticketId, updated);
    return updated;
  }

  public async listMessages(ticketId: string): Promise<readonly SupportMessageRecord[]> {
    return this.messages.filter((message) => message.ticketId === ticketId);
  }
}

export class InMemoryContactRequestsRepository implements ContactRequestsRepository {
  public readonly requests: ContactRequestRecord[] = [];

  public async createContactRequest(request: NewContactRequest, now: Date): Promise<ContactRequestRecord> {
    const record: ContactRequestRecord = { ...request, id: randomUUID(), createdAt: now };
    this.requests.push(record);
    return record;
  }
}
