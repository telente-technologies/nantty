import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { ListStoreOrdersQuery } from "./listStoreOrders.query.js";

export class ListStoreOrdersHandler extends QueryHandler<ListStoreOrdersQuery, Page<OrderRecord>> {
  public readonly queryType = "orders.listStoreOrders" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(query: ListStoreOrdersQuery): Promise<Page<OrderRecord>> {
    return this.service.listSellerOrders(query.principal.userId, query.requestedStoreId, query.status, query.searchTerm, query.page);
  }
}
