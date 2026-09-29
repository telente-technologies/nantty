import { QueryHandler } from "@zudojs/cqrs";

import { convertTicketToSummary, type SupportTicketSummaryDto } from "../../dtos/support.dto.js";
import type { SupportService } from "../../services/support.service.js";
import type { ListMySupportTicketsQuery } from "./listMySupportTickets.query.js";

const MY_TICKETS_LIMIT = 100;

export class ListMySupportTicketsHandler extends QueryHandler<ListMySupportTicketsQuery, readonly SupportTicketSummaryDto[]> {
  public readonly queryType = "support.listMySupportTickets" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(query: ListMySupportTicketsQuery): Promise<readonly SupportTicketSummaryDto[]> {
    const tickets = await this.supportService.dependencies.tickets.listTicketsForRequester(query.principal.userId, MY_TICKETS_LIMIT);
    return tickets.map(convertTicketToSummary);
  }
}
