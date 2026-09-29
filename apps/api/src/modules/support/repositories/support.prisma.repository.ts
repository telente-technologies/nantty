import type { SupportTicket } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import {
  MESSAGE_PREVIEW_LENGTH,
  type ContactRequestKind,
  type ContactRequestRecord,
  type NewContactRequest,
  type NewSupportMessage,
  type NewSupportTicket,
  type SupportMessageRecord,
  type SupportTicketCategory,
  type SupportTicketChanges,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from "../models/support.model.js";
import type { ContactRequestsRepository, SupportTicketsRepository } from "./support.repository.js";

function convertTicketRow(row: SupportTicket): SupportTicketRecord {
  return { ...row, category: row.category as SupportTicketCategory, status: row.status as SupportTicketStatus };
}

export class PrismaSupportTicketsRepository implements SupportTicketsRepository {
  public async createTicket(ticket: NewSupportTicket, firstMessage: Omit<NewSupportMessage, "ticketId">, now: Date): Promise<SupportTicketRecord> {
    const row = await prisma().$transaction(async (transaction) => {
      const created = await transaction.supportTicket.create({
        data: { ...ticket, lastMessagePreview: firstMessage.text.slice(0, MESSAGE_PREVIEW_LENGTH), createdAt: now, updatedAt: now },
      });
      await transaction.supportTicketMessage.create({ data: { ...firstMessage, attachmentMediaIds: [...firstMessage.attachmentMediaIds], ticketId: created.id, createdAt: now } });
      return created;
    });
    return convertTicketRow(row);
  }

  public async findTicket(ticketId: string): Promise<SupportTicketRecord | undefined> {
    const row = await prisma().supportTicket.findUnique({ where: { id: ticketId } });
    return row === null ? undefined : convertTicketRow(row);
  }

  public async listTicketsForRequester(requesterId: string, limit: number): Promise<readonly SupportTicketRecord[]> {
    return (await prisma().supportTicket.findMany({ where: { requesterId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit })).map(convertTicketRow);
  }

  public async listTickets(status: SupportTicketStatus | undefined, page: PageRequest): Promise<Page<SupportTicketRecord>> {
    const rows = await prisma().supportTicket.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertTicketRow);
  }

  public async appendMessage(message: NewSupportMessage, ticketChanges: SupportTicketChanges, now: Date): Promise<SupportMessageRecord> {
    const [row] = await prisma().$transaction([
      prisma().supportTicketMessage.create({ data: { ...message, attachmentMediaIds: [...message.attachmentMediaIds], createdAt: now } }),
      prisma().supportTicket.update({ where: { id: message.ticketId }, data: { ...ticketChanges, updatedAt: now } }),
    ]);
    return row;
  }

  public async updateTicket(ticketId: string, changes: SupportTicketChanges, now: Date): Promise<SupportTicketRecord | undefined> {
    await prisma().supportTicket.updateMany({ where: { id: ticketId }, data: { ...changes, updatedAt: now } });
    return this.findTicket(ticketId);
  }

  public listMessages(ticketId: string): Promise<readonly SupportMessageRecord[]> {
    return prisma().supportTicketMessage.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 500 });
  }
}

export class PrismaContactRequestsRepository implements ContactRequestsRepository {
  public async createContactRequest(request: NewContactRequest, now: Date): Promise<ContactRequestRecord> {
    const row = await prisma().supportContactRequest.create({ data: { ...request, createdAt: now } });
    return { ...row, kind: row.kind as ContactRequestKind };
  }
}
