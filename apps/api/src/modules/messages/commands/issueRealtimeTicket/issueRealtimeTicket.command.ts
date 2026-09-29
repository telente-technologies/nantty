import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class IssueRealtimeTicketCommand extends Command<"messages.issueRealtimeTicket"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("messages.issueRealtimeTicket");
  }
}
