import { conflict, notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import { ticketRepliedEvent } from "../../services/ticketEvents.service.js";
import { buildStatusTransition } from "../../services/ticketTransitions.service.js";
import type { PostStaffReplyCommand } from "./postStaffReply.command.js";

export async function handlePostStaffReply(dependencies: TicketModuleDependencies, command: PostStaffReplyCommand): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(command.ticketId);
  if (ticket === null) throw notFound("Ticket");
  const now = dependencies.clock.now();
  const body = command.body.trim();
  if (command.isInternalNote) {
    return dependencies.store.writeTicket(ticket.id, {
      message: { authorKind: "internal_note", authorId: command.staff.id, authorName: command.staff.name, body, attachments: [] },
      update: { messageCountIncrement: 1 },
      history: { action: "support.internal_note_added", actorId: command.staff.id, actorName: command.staff.name },
    });
  }
  if (ticket.status === "closed") throw conflict("TICKET_CLOSED", "This ticket is closed. Reopen it before replying to the customer.");
  const status = command.statusAfterReply ?? "awaiting_user";
  const transition = status === ticket.status && status !== "resolved" ? { update: {}, events: [] } : buildStatusTransition(ticket, status, now, body);
  const repliedTicket = { ...ticket, status, updatedAt: now };
  return dependencies.store.writeTicket(ticket.id, {
    message: { authorKind: "agent", authorId: command.staff.id, authorName: command.staff.name, body, attachments: [] },
    update: {
      ...transition.update, status, lastMessageAt: now, lastMessagePreview: body.slice(0, 140), messageCountIncrement: 1, requesterUnreadIncrement: 1,
      ...(ticket.firstRespondedAt === null ? { firstRespondedAt: now } : {}),
      ...(ticket.assigneeStaffId === null ? { assigneeStaffId: command.staff.id, assigneeName: command.staff.name } : {}),
    },
    history: { action: "support.reply_sent", actorId: command.staff.id, actorName: command.staff.name, detail: { statusAfterReply: status } },
    events: [ticketRepliedEvent(repliedTicket, { authorKind: "agent", authorName: command.staff.name, body }, now), ...transition.events],
  });
}
