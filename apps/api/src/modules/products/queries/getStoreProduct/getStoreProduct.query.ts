import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetStoreProductQuery extends Query<"products.getStoreProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
  ) {
    super("products.getStoreProduct");
  }
}
