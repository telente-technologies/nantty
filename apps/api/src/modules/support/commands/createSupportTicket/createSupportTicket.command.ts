import { Command } from "@zudojs/cqrs";

import type { CreateTicketBody } from "../../validators/support.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateSupportTicketCommand extends Command<"support.createSupportTicket"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateTicketBody,
  ) {
    super("support.createSupportTicket");
  }
}
