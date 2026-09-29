import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListConversationsQuery extends Query<"messages.listConversations"> {
  public constructor(
    public readonly principal: Principal,
    public readonly filter: "all" | "direct",
    public readonly searchTerm: string | undefined,
  ) {
    super("messages.listConversations");
  }
}
