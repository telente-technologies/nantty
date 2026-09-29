import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { PublicOrderStatus } from "../../models/orders.model.js";

export class ListMyOrdersQuery extends Query<"orders.listMyOrders"> {
  public constructor(
    public readonly principal: Principal,
    public readonly status: PublicOrderStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("orders.listMyOrders");
  }
}
