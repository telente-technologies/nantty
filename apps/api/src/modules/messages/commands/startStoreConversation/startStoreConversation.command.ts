import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class StartStoreConversationCommand extends Command<"messages.startStoreConversation"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
  ) {
    super("messages.startStoreConversation");
  }
}
