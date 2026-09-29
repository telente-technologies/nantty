import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ConfirmOrderReceiptCommand extends Command<"orders.confirmOrderReceipt"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("orders.confirmOrderReceipt");
  }
}
