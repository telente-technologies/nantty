import { Command } from "@zudojs/cqrs";

import type { CreateChannelBody } from "../../validators/messages.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateChannelCommand extends Command<"messages.createChannel"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateChannelBody,
  ) {
    super("messages.createChannel");
  }
}
