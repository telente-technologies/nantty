import { reopenWindowDays } from "../../../../constants/support.constant.js";
import { conflict, notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import { validateAttachmentUrls, validateRequesterAttachments } from "../../services/attachmentPolicy.service.js";
import { ticketRepliedEvent } from "../../services/ticketEvents.service.js";
import type { PostCustomerReplyCommand } from "./postCustomerReply.command.js";

export async function handlePostCustomerReply(dependencies: TicketModuleDependencies, command: PostCustomerReplyCommand): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(command.ticketId);
  if (ticket === null || ticket.requesterAccountId !== command.accountId) throw notFound("Ticket");
  const body = command.text.trim();
  if (command.idempotencyKey !== null) {
    const prior = await dependencies.store.findMessageByIdempotencyKey(ticket.id, command.accountId, command.idempotencyKey);
    if (prior !== null) {
      const retryAttachments = validateAttachmentUrls(command.attachmentUrls, dependencies.mediaPublicBaseUrls).map(({ url, contentType }) => ({ url, contentType }));
      const sameAttachments = JSON.stringify(prior.attachments) === JSON.stringify(retryAttachments);
      if (prior.authorKind !== "customer" || prior.body !== body || !sameAttachments) {
        throw conflict("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different reply.");
      }
      return (await dependencies.store.findTicket(ticket.id)) ?? ticket;
    }
  }
  const attachments = await validateRequesterAttachments(command.attachmentUrls, { allowedBaseUrls: dependencies.mediaPublicBaseUrls, media: dependencies.media, requesterId: command.accountId });
  const now = dependencies.clock.now();
  if (ticket.status === "closed") throw conflict("TICKET_CLOSED", "This ticket is closed. Open a new ticket and we will pick it up.");
  const reopening = ticket.status === "resolved";
  if (reopening && ticket.resolvedAt !== null && now.getTime() - ticket.resolvedAt.getTime() > reopenWindowDays * 86_400_000) {
    throw conflict("TICKET_CLOSED", "This ticket was resolved more than 7 days ago. Open a new ticket and we will pick it up.");
  }
  const status = ticket.status === "open" && ticket.firstRespondedAt === null ? "open" : "awaiting_support";
  const updated = { ...ticket, status, updatedAt: now } as const;
  return dependencies.store.writeTicket(ticket.id, {
    message: { authorKind: "customer", authorId: command.accountId, authorName: ticket.requesterName, body, attachments, idempotencyKey: command.idempotencyKey },
    update: { status, lastMessageAt: now, lastMessagePreview: body.slice(0, 140), messageCountIncrement: 1, resetRequesterUnread: true, ...(reopening ? { resolvedAt: null, autoFaqStatus: ticket.autoFaqStatus === "queued" ? "none" : ticket.autoFaqStatus } : {}) },
    ...(reopening ? { history: { action: "support.ticket_reopened", actorId: command.accountId, actorName: ticket.requesterName } } : {}),
    events: [ticketRepliedEvent(updated, { authorKind: "customer", authorName: ticket.requesterName, body }, now)],
  });
}
