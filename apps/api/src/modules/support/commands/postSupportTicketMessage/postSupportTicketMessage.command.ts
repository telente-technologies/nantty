import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { TicketMessageBody } from "../../validators/support.validator.js";

export class PostSupportTicketMessageCommand extends Command<"support.postSupportTicketMessage"> {
  public constructor(
    public readonly principal: Principal,
    public readonly ticketId: string,
    public readonly input: TicketMessageBody,
    public readonly asAgent: boolean,
  ) {
    super("support.postSupportTicketMessage");
  }
}
