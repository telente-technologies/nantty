import { Query } from "@zudojs/cqrs";

import type { OrderStatus } from "../../../../enums/orderStatus.enum.js";
import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListStoreOrdersQuery extends Query<"orders.listStoreOrders"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly statuses: readonly OrderStatus[] | undefined,
    public readonly page: PageRequest,
  ) {
    super("orders.listStoreOrders");
  }
}
