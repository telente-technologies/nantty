import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateConversationBody } from "../../validators/messages.validator.js";

export class UpdateConversationSettingsCommand extends Command<"messages.updateConversationSettings"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
    public readonly input: UpdateConversationBody,
  ) {
    super("messages.updateConversationSettings");
  }
}
