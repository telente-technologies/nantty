import { CommandHandler } from "@zudojs/cqrs";

import type { IssuedRealtimeTicket, RealtimeTicketService } from "../../services/realtimeTickets.service.js";
import type { IssueRealtimeTicketCommand } from "./issueRealtimeTicket.command.js";

export class IssueRealtimeTicketHandler extends CommandHandler<IssueRealtimeTicketCommand, IssuedRealtimeTicket> {
  public readonly commandType = "messages.issueRealtimeTicket" as const;

  public constructor(private readonly tickets: RealtimeTicketService) {
    super();
  }

  public execute(command: IssueRealtimeTicketCommand): Promise<IssuedRealtimeTicket> {
    return this.tickets.issueTicket(command.principal);
  }
}
