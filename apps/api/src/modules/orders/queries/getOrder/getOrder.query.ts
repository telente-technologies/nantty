import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetOrderQuery extends Query<"orders.getOrder"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("orders.getOrder");
  }
}
