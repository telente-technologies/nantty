import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ResolveSellerStoreQuery extends Query<"products.resolveSellerStore"> {
  public constructor(
    public readonly principal: Principal,
    public readonly requestedStoreId: string | undefined,
    public readonly productId: string | undefined,
  ) {
    super("products.resolveSellerStore");
  }
}
