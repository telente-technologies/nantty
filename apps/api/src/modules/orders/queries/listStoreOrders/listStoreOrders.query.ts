import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { PublicOrderStatus } from "../../models/orders.model.js";

export class ListStoreOrdersQuery extends Query<"orders.listStoreOrders"> {
  public constructor(
    public readonly principal: Principal,
    public readonly requestedStoreId: string | undefined,
    public readonly status: PublicOrderStatus | undefined,
    public readonly searchTerm: string | undefined,
    public readonly page: PageRequest,
  ) {
    super("orders.listStoreOrders");
  }
}
