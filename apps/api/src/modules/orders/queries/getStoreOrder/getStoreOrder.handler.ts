import { QueryHandler } from "@zudojs/cqrs";

import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { GetStoreOrderQuery } from "./getStoreOrder.query.js";

export class GetStoreOrderHandler extends QueryHandler<GetStoreOrderQuery, OrderRecord> {
  public readonly queryType = "orders.getStoreOrder" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(query: GetStoreOrderQuery): Promise<OrderRecord> {
    return this.service.findOrderForStoreMember(query.principal.userId, query.storeId, query.orderId);
  }
}
