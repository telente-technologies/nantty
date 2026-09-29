import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetStoreOrderQuery extends Query<"orders.getStoreOrder"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("orders.getStoreOrder");
  }
}
