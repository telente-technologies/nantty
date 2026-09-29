import type { CoinPacksService } from "./coinPacks.service.js";
import type { CoinPurchasesService } from "./coinPurchases.service.js";
import type { CoinWalletService } from "./coinWallet.service.js";
import type { StoreReceiptsService } from "./storeReceipts.service.js";

export interface CoinsServices {
  readonly wallet: CoinWalletService;
  readonly purchases: CoinPurchasesService;
  readonly receipts: StoreReceiptsService;
  readonly packs: CoinPacksService;
}
