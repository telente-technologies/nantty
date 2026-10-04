import { isTicketStatusStopped } from "../../../../enums/ticket.enum.js";
import { conflict, notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import type { RateTicketCommand } from "./rateTicket.command.js";

export async function handleRateTicket(dependencies: TicketModuleDependencies, command: RateTicketCommand): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(command.ticketId);
  if (ticket === null || ticket.requesterAccountId !== command.accountId) throw notFound("Ticket");
  if (!isTicketStatusStopped(ticket.status)) throw conflict("TICKET_NOT_RESOLVED", "You can rate support once your ticket is resolved.");
  return dependencies.store.writeTicket(ticket.id, {
    update: { satisfactionScore: command.score, satisfactionComment: command.comment },
    history: { action: "support.ticket_rated", actorId: command.accountId, actorName: ticket.requesterName, detail: { score: command.score } },
  });
}
