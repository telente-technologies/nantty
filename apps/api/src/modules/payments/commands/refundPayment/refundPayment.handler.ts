import { CommandHandler } from "@zudojs/cqrs";

import type { EscrowRecord } from "../../../escrows/models/escrows.model.js";
import type { EscrowsService } from "../../../escrows/services/escrows.service.js";
import type { RefundPaymentCommand } from "./refundPayment.command.js";

export class RefundPaymentHandler extends CommandHandler<RefundPaymentCommand, EscrowRecord> {
  public readonly commandType = "payments.refundPayment" as const;

  public constructor(private readonly escrowsService: EscrowsService) {
    super();
  }

  public async execute(command: RefundPaymentCommand): Promise<EscrowRecord> {
    const escrow = await this.escrowsService.findEscrowForOrder(command.orderId);
    return this.escrowsService.refundEscrowToBuyer(escrow, command.principal.userId, ["held", "disputed"]);
  }
}
