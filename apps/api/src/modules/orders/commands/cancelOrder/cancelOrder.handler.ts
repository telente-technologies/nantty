import { CommandHandler } from "@zudojs/cqrs";

import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { CancelOrderCommand } from "./cancelOrder.command.js";

export class CancelOrderHandler extends CommandHandler<CancelOrderCommand, OrderRecord> {
  public readonly commandType = "orders.cancelOrder" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(command: CancelOrderCommand): Promise<OrderRecord> {
    return this.service.cancelOrderBeforePayment(command.principal.userId, command.orderId);
  }
}
