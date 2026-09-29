import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import { convertTicketToSummary, type SupportTicketSummaryDto } from "../../dtos/support.dto.js";
import type { SupportService } from "../../services/support.service.js";
import type { ListSupportTicketsQuery } from "./listSupportTickets.query.js";

export class ListSupportTicketsHandler extends QueryHandler<ListSupportTicketsQuery, Page<SupportTicketSummaryDto>> {
  public readonly queryType = "support.listSupportTickets" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(query: ListSupportTicketsQuery): Promise<Page<SupportTicketSummaryDto>> {
    return mapPageItems(await this.supportService.dependencies.tickets.listTickets(query.status, query.page), convertTicketToSummary);
  }
}
