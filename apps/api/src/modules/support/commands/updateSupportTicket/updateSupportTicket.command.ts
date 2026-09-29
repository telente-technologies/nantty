import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateTicketBody } from "../../validators/support.validator.js";

export class UpdateSupportTicketCommand extends Command<"support.updateSupportTicket"> {
  public constructor(
    public readonly principal: Principal,
    public readonly ticketId: string,
    public readonly input: UpdateTicketBody,
  ) {
    super("support.updateSupportTicket");
  }
}
