import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { ListMyOrdersQuery } from "./listMyOrders.query.js";

export class ListMyOrdersHandler extends QueryHandler<ListMyOrdersQuery, Page<OrderRecord>> {
  public readonly queryType = "orders.listMyOrders" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(query: ListMyOrdersQuery): Promise<Page<OrderRecord>> {
    return this.service.listBuyerOrders(query.principal.userId, query.filter, query.page);
  }
}
