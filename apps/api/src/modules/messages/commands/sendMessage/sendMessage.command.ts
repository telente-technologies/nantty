import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SendMessageBody } from "../../validators/messages.validator.js";

export class SendMessageCommand extends Command<"messages.sendMessage"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
    public readonly input: SendMessageBody,
  ) {
    super("messages.sendMessage");
  }
}
