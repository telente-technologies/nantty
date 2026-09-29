import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class StartConversationCommand extends Command<"messages.startConversation"> {
  public constructor(
    public readonly principal: Principal,
    public readonly otherUserId: string,
  ) {
    super("messages.startConversation");
  }
}
