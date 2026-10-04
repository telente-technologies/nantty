import { agentActivityWindowDays } from "../../../../constants/support.constant.js";
import { badRequest, conflict, forbidden, notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import type { AssignTicketCommand } from "./assignTicket.command.js";

export async function handleAssignTicket(dependencies: TicketModuleDependencies, command: AssignTicketCommand): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(command.ticketId);
  if (ticket === null) throw notFound("Ticket");
  if (!command.canAssignOthers && command.assigneeId !== command.staff.id) throw forbidden("You can only assign tickets to yourself. Ask a lead with ticket assignment access.");
  if (command.assigneeId === ticket.assigneeStaffId) throw conflict("NO_CHANGE", "The ticket is already assigned to this agent.");
  let assigneeName: string | null = null;
  if (command.assigneeId !== null) {
    const since = new Date(dependencies.clock.now().getTime() - agentActivityWindowDays * 86_400_000);
    const agent = command.assigneeId === command.staff.id ? { name: command.staff.name } : (await dependencies.store.listAgentsSeenSince(since)).find((candidate) => candidate.staffId === command.assigneeId);
    if (agent === undefined) throw badRequest("VALIDATION_FAILED", "Choose an active support agent.");
    assigneeName = agent.name;
  }
  return dependencies.store.writeTicket(ticket.id, {
    update: { assigneeStaffId: command.assigneeId, assigneeName },
    history: { action: command.assigneeId === null ? "support.ticket_unassigned" : "support.ticket_assigned", actorId: command.staff.id, actorName: command.staff.name, reason: command.reason, detail: { assignee: assigneeName } },
  });
}
