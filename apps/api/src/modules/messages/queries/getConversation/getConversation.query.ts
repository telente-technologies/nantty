import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetConversationQuery extends Query<"messages.getConversation"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
  ) {
    super("messages.getConversation");
  }
}
