import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetSupportTicketQuery extends Query<"support.getSupportTicket"> {
  public constructor(
    public readonly principal: Principal,
    public readonly ticketId: string,
    public readonly asAgent: boolean,
  ) {
    super("support.getSupportTicket");
  }
}
