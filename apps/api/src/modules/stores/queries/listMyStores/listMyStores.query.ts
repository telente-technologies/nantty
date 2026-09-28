import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMyStoresQuery extends Query<"stores.listMyStores"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("stores.listMyStores");
  }
}
