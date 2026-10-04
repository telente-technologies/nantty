import { conflict, notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import { buildStatusTransition } from "../../services/ticketTransitions.service.js";
import type { ChangeTicketStatusCommand } from "./changeTicketStatus.command.js";

export async function handleChangeTicketStatus(dependencies: TicketModuleDependencies, command: ChangeTicketStatusCommand): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(command.ticketId);
  if (ticket === null) throw notFound("Ticket");
  if (ticket.status === command.status) throw conflict("NO_CHANGE", `This ticket is already ${command.status.replace("_", " ")}.`);
  const transition = buildStatusTransition(ticket, command.status, dependencies.clock.now());
  return dependencies.store.writeTicket(ticket.id, {
    update: transition.update,
    history: { action: "support.status_changed", actorId: command.actor.id, actorName: command.actor.name, reason: command.reason, detail: { from: ticket.status, to: command.status } },
    events: transition.events,
  });
}
