import { QueryHandler } from "@zudojs/cqrs";

import type { SupportTicketDetailDto } from "../../dtos/support.dto.js";
import type { SupportService } from "../../services/support.service.js";
import type { GetSupportTicketQuery } from "./getSupportTicket.query.js";

export class GetSupportTicketHandler extends QueryHandler<GetSupportTicketQuery, SupportTicketDetailDto> {
  public readonly queryType = "support.getSupportTicket" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(query: GetSupportTicketQuery): Promise<SupportTicketDetailDto> {
    const ticket = await this.supportService.requireTicketForViewer(query.ticketId, query.principal, query.asAgent);
    return this.supportService.presentTicket(ticket, query.principal.userId);
  }
}
