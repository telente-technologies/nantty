import { Query } from "@zudojs/cqrs";

import type { ConversationListFilter } from "../../validators/messages.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListConversationsQuery extends Query<"messages.listConversations"> {
  public constructor(
    public readonly principal: Principal,
    public readonly filter: ConversationListFilter,
    public readonly searchTerm: string | undefined,
  ) {
    super("messages.listConversations");
  }
}
