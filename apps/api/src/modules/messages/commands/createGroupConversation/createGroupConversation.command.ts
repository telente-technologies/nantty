import { Command } from "@zudojs/cqrs";

import type { CreateGroupBody } from "../../validators/messages.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateGroupConversationCommand extends Command<"messages.createGroupConversation"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateGroupBody,
  ) {
    super("messages.createGroupConversation");
  }
}
