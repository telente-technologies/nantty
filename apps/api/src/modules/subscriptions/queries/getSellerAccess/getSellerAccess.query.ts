import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetSellerAccessQuery extends Query<"subscriptions.getSellerAccess"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
  ) {
    super("subscriptions.getSellerAccess");
  }
}
