import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListStoreMembersQuery extends Query<"stores.listStoreMembers"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
  ) {
    super("stores.listStoreMembers");
  }
}
