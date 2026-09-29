import { CommandHandler } from "@zudojs/cqrs";

import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { MarkOrderShippedCommand } from "./markOrderShipped.command.js";

export class MarkOrderShippedHandler extends CommandHandler<MarkOrderShippedCommand, OrderRecord> {
  public readonly commandType = "orders.markOrderShipped" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(command: MarkOrderShippedCommand): Promise<OrderRecord> {
    return this.service.markOrderShipped(command.principal.userId, command.storeId, command.orderId, command.trackingNumber);
  }
}
