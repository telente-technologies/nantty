import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListStoreInventoryQuery extends Query<"products.listStoreInventory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
  ) {
    super("products.listStoreInventory");
  }
}
