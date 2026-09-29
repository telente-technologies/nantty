import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListConversationMembersQuery extends Query<"messages.listConversationMembers"> {
  public constructor(
    public readonly principal: Principal,
    public readonly conversationId: string,
  ) {
    super("messages.listConversationMembers");
  }
}
