import { notFound } from "../../../../errors/support.error.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import type { GetRequesterTicketQuery } from "./getRequesterTicket.query.js";

export async function handleGetRequesterTicket(dependencies: TicketModuleDependencies, query: GetRequesterTicketQuery): Promise<TicketWithThread> {
  const ticket = await dependencies.store.findTicket(query.ticketId);
  if (ticket === null || ticket.requesterAccountId !== query.accountId) throw notFound("Ticket");
  return ticket;
}
