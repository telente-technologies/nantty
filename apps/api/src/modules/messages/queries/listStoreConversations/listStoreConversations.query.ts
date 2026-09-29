import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListStoreConversationsQuery extends Query<"messages.listStoreConversations"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
  ) {
    super("messages.listStoreConversations");
  }
}
