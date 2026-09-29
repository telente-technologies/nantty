import { CommandHandler } from "@zudojs/cqrs";

import { invalidState } from "../../../../errors/domain.error.js";
import type { EscrowRecord } from "../../../escrows/models/escrows.model.js";
import type { EscrowsService } from "../../../escrows/services/escrows.service.js";
import type { OrdersService } from "../../services/orders.service.js";
import type { ConfirmOrderReceiptCommand } from "./confirmOrderReceipt.command.js";

export class ConfirmOrderReceiptHandler extends CommandHandler<ConfirmOrderReceiptCommand, EscrowRecord> {
  public readonly commandType = "orders.confirmOrderReceipt" as const;

  public constructor(private readonly ordersService: OrdersService, private readonly escrowsService: EscrowsService) {
    super();
  }

  public async execute(command: ConfirmOrderReceiptCommand): Promise<EscrowRecord> {
    const order = await this.ordersService.findOrderForBuyer(command.principal.userId, command.orderId);
    if (!["paid", "shipped", "delivered"].includes(order.status)) throw invalidState("This order cannot be confirmed right now.");
    const escrow = await this.escrowsService.findEscrowForOrder(order.id);
    return this.escrowsService.releaseEscrowFundsToSellerWallet(escrow, "buyer_confirmed", command.principal.userId);
  }
}
