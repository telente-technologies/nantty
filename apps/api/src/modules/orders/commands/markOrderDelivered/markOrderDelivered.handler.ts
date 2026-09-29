import { CommandHandler } from "@zudojs/cqrs";

import type { EscrowsService } from "../../../escrows/services/escrows.service.js";
import type { OrderRecord } from "../../models/orders.model.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { MarkOrderDeliveredCommand } from "./markOrderDelivered.command.js";

export class MarkOrderDeliveredHandler extends CommandHandler<MarkOrderDeliveredCommand, OrderRecord> {
  public readonly commandType = "orders.markOrderDelivered" as const;

  public constructor(private readonly ordersService: OrdersService, private readonly escrowsService: EscrowsService) {
    super();
  }

  public async execute(command: MarkOrderDeliveredCommand): Promise<OrderRecord> {
    const order = await this.ordersService.markOrderDelivered(command.principal.userId, command.storeId, command.orderId);
    await this.escrowsService.scheduleAutomaticRelease(order.id, order.deliveredAt ?? new Date());
    return order;
  }
}
