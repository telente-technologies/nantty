import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { buildOutboxRows, type DomainEventInput } from "../../../events/outbox.event.js";
import { notFound } from "../../../errors/support.error.js";
import type { TicketStore, TicketWrite } from "../../../interfaces/ticketStore.interface.js";
import type { NewHistoryEntry, NewTicketMessage, TicketQueueFilter, TicketUpdate } from "../../../types/ticket.type.js";
import { mapTicketRow, mapTicketRowWithThread, threadInclude } from "./ticketMapping.repository.js";
import { createSupportAuxiliaryRepository } from "./supportAuxiliary.prisma.repository.js";

type Transaction = Prisma.TransactionClient;

function messageRow(ticketId: string, message: NewTicketMessage) {
  return { id: randomUUID(), ticketId, authorKind: message.authorKind, authorId: message.authorId, authorName: message.authorName, body: message.body, attachments: message.attachments as unknown as Prisma.InputJsonValue };
}

function historyRow(ticketId: string, entry: NewHistoryEntry) {
  return { id: randomUUID(), ticketId, action: entry.action, actorId: entry.actorId, actorName: entry.actorName, reason: entry.reason ?? null, detail: (entry.detail ?? {}) as Prisma.InputJsonValue };
}

async function appendOutbox(transaction: Transaction, events: readonly DomainEventInput[] | undefined): Promise<void> {
  if (events === undefined || events.length === 0) return;
  await transaction.outboxEvent.createMany({ data: buildOutboxRows(events).map((row) => ({ ...row, payload: row.payload as Prisma.InputJsonValue })) });
}

function updateData(update: TicketUpdate | undefined): Prisma.SupportTicketUpdateInput {
  if (update === undefined) return {};
  const { requesterUnreadIncrement, resetRequesterUnread, messageCountIncrement, ...fields } = update;
  return {
    ...fields,
    ...(resetRequesterUnread === true ? { requesterUnread: 0 } : requesterUnreadIncrement === undefined ? {} : { requesterUnread: { increment: requesterUnreadIncrement } }),
    ...(messageCountIncrement === undefined ? {} : { messageCount: { increment: messageCountIncrement } }),
  };
}

function queueWhere(filter: TicketQueueFilter): Prisma.SupportTicketWhereInput {
  const search = filter.search?.trim();
  const number = search === undefined ? Number.NaN : Number(search.replace(/^sup-/i, ""));
  return {
    ...(filter.statuses === undefined ? {} : { status: { in: [...filter.statuses] } }),
    ...(filter.priority === undefined ? {} : { priority: filter.priority }),
    ...(filter.category === undefined ? {} : { category: filter.category }),
    ...(filter.channel === undefined ? {} : { channel: filter.channel }),
    ...(filter.assignee.kind === "unassigned" ? { assigneeStaffId: null } : filter.assignee.kind === "staff" ? { assigneeStaffId: filter.assignee.staffId } : {}),
    ...(search === undefined || search === ""
      ? {}
      : { OR: [{ subject: { contains: search, mode: "insensitive" } }, { linkedId: search }, { requesterUsername: { equals: search.replace(/^@/, ""), mode: "insensitive" } }, ...(Number.isInteger(number) ? [{ number }] : [])] }),
  };
}

export function createTicketPrismaRepository(prisma: PrismaClient): TicketStore {
  const findWithThread = async (where: Prisma.SupportTicketWhereUniqueInput) => {
    const row = await prisma.supportTicket.findUnique({ where, include: threadInclude });
    return row === null ? null : mapTicketRowWithThread(row);
  };
  return {
    ...createSupportAuxiliaryRepository(prisma),
    async createTicket(ticket, firstMessage, buildEvents) {
      const id = randomUUID();
      await prisma.$transaction(async (transaction) => {
        const { linkedReference, ...fields } = ticket;
        const created = await transaction.supportTicket.create({
          data: {
            id, ...fields, status: "open", linkedKind: linkedReference?.kind ?? null, linkedId: linkedReference?.id ?? null, linkedLabel: linkedReference?.label ?? null,
            lastMessagePreview: firstMessage.body.slice(0, 140), messageCount: 1,
            messages: { create: { ...messageRow(id, firstMessage), ticketId: undefined } },
          },
        });
        await transaction.supportTicketEvent.create({ data: historyRow(id, { action: "support.ticket_created", actorId: ticket.requesterAccountId, actorName: ticket.requesterName, detail: { channel: ticket.channel } }) });
        await appendOutbox(transaction, buildEvents(mapTicketRow(created)));
      });
      const created = await findWithThread({ id });
      if (created === null) throw notFound("Ticket");
      return created;
    },
    async findTicketByIdempotencyKey(accountId, key) {
      return findWithThread({ requesterAccountId_idempotencyKey: { requesterAccountId: accountId, idempotencyKey: key } });
    },
    findTicket: (ticketId) => findWithThread({ id: ticketId }),
    findTicketByNumber: (number) => findWithThread({ number }),
    async listTicketsForRequester(accountId) {
      const rows = await prisma.supportTicket.findMany({ where: { requesterAccountId: accountId, anonymizedAt: null }, orderBy: { updatedAt: "desc" }, take: 200 });
      return rows.map(mapTicketRow);
    },
    async listTicketQueue(filter) {
      const where = queueWhere(filter);
      const [rows, total] = await Promise.all([
        prisma.supportTicket.findMany({ where, orderBy: [{ resolutionDueAt: "asc" }], skip: (filter.page - 1) * filter.pageSize, take: filter.pageSize }),
        prisma.supportTicket.count({ where }),
      ]);
      return { items: rows.map(mapTicketRow), total };
    },
    async writeTicket(ticketId, write: TicketWrite) {
      await prisma.$transaction(async (transaction) => {
        const exists = await transaction.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
        if (exists === null) throw notFound("Ticket");
        if (write.message !== undefined) await transaction.supportTicketMessage.create({ data: messageRow(ticketId, write.message) });
        if (write.history !== undefined) await transaction.supportTicketEvent.create({ data: historyRow(ticketId, write.history) });
        if (write.update !== undefined) await transaction.supportTicket.update({ where: { id: ticketId }, data: updateData(write.update) });
        await appendOutbox(transaction, write.events);
      });
      const updated = await findWithThread({ id: ticketId });
      if (updated === null) throw notFound("Ticket");
      return updated;
    },
    async countRequesterUnread(accountId) {
      const result = await prisma.supportTicket.aggregate({ where: { requesterAccountId: accountId, anonymizedAt: null }, _sum: { requesterUnread: true } });
      return result._sum.requesterUnread ?? 0;
    },
    async claimTicketsQueuedForAutoFaq(limit, now, lockMilliseconds) {
      const candidates = await prisma.supportTicket.findMany({
        where: { autoFaqStatus: "queued", OR: [{ autoFaqLockedUntil: null }, { autoFaqLockedUntil: { lt: now } }] }, select: { id: true }, take: limit, orderBy: { updatedAt: "asc" },
      });
      const claimed = [];
      for (const candidate of candidates) {
        const locked = await prisma.supportTicket.updateMany({
          where: { id: candidate.id, autoFaqStatus: "queued", OR: [{ autoFaqLockedUntil: null }, { autoFaqLockedUntil: { lt: now } }] },
          data: { autoFaqLockedUntil: new Date(now.getTime() + lockMilliseconds) },
        });
        if (locked.count === 1) {
          const ticket = await findWithThread({ id: candidate.id });
          if (ticket !== null) claimed.push(ticket);
        }
      }
      return claimed;
    },
    async setAutoFaqStatus(ticketId, status) {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { autoFaqStatus: status, autoFaqLockedUntil: null } });
    },
    async closeResolvedTicketsBefore(cutoff, now) {
      const result = await prisma.supportTicket.updateMany({ where: { status: "resolved", resolvedAt: { lt: cutoff } }, data: { status: "closed", closedAt: now } });
      return result.count;
    },
    async anonymizeRequester(accountId, now) {
      return prisma.$transaction(async (transaction) => {
        const tickets = await transaction.supportTicket.findMany({ where: { requesterAccountId: accountId, anonymizedAt: null }, select: { id: true } });
        const ids = tickets.map((ticket) => ticket.id);
        if (ids.length === 0) return 0;
        await transaction.supportTicketMessage.updateMany({ where: { ticketId: { in: ids }, authorKind: "customer" }, data: { body: "[removed after account deletion]", authorName: "Deleted user", attachments: [] } });
        await transaction.supportTicket.updateMany({
          where: { id: { in: ids } },
          data: { requesterName: "Deleted user", requesterUsername: "", subject: "Ticket from a deleted account", lastMessagePreview: "", linkedLabel: null, satisfactionComment: null, anonymizedAt: now },
        });
        return ids.length;
      });
    },
  };
}
