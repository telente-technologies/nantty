import { priorityRank } from "../../../../constants/ticketSla.constant.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import { presentTicketForStaff } from "../../services/ticketPresenter.service.js";
import type { ListTicketQueueQuery } from "./listTicketQueue.query.js";

export async function handleListTicketQueue(dependencies: TicketModuleDependencies, query: ListTicketQueueQuery) {
  const now = dependencies.clock.now();
  const { items, total } = await dependencies.store.listTicketQueue(query);
  const presented = items
    .map((ticket) => ({ ticket, view: presentTicketForStaff(ticket, now) }))
    .sort((first, second) => Number(second.view.isSlaBreached) - Number(first.view.isSlaBreached) || priorityRank[first.ticket.priority] - priorityRank[second.ticket.priority] || first.ticket.resolutionDueAt.getTime() - second.ticket.resolutionDueAt.getTime())
    .map((entry) => entry.view);
  return { items: presented, page: query.page, pageSize: query.pageSize, total };
}
