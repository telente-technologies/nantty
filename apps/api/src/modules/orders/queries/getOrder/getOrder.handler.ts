import { QueryHandler } from "@zudojs/cqrs";

import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { GetOrderQuery } from "./getOrder.query.js";

export class GetOrderHandler extends QueryHandler<GetOrderQuery, OrderRecord> {
  public readonly queryType = "orders.getOrder" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(query: GetOrderQuery): Promise<OrderRecord> {
    return this.service.findOrderForBuyer(query.principal.userId, query.orderId);
  }
}
