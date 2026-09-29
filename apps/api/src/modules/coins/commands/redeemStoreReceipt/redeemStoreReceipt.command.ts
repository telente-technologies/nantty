import { Command } from "@zudojs/cqrs";

import type { StoreReceiptRequest } from "../../services/storeReceipts.service.js";

export class RedeemStoreReceiptCommand extends Command<"coins.redeemStoreReceipt"> {
  public constructor(
    public readonly request: StoreReceiptRequest,
  ) {
    super("coins.redeemStoreReceipt");
  }
}
