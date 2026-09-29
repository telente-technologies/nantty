import { Query } from "@zudojs/cqrs";

import type { BuyerOrderFilter } from "../../models/orders.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMyOrdersQuery extends Query<"orders.listMyOrders"> {
  public constructor(
    public readonly principal: Principal,
    public readonly filter: BuyerOrderFilter,
    public readonly page: PageRequest,
  ) {
    super("orders.listMyOrders");
  }
}
