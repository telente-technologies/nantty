import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkConversationReadCommand extends Command<"messages.markConversationRead"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
  ) {
    super("messages.markConversationRead");
  }
}
