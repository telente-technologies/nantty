import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CoinsController } from "../controllers/coins.controller.js";
import {
  CoinPackParamsSchema,
  CoinPageQuerySchema,
  CoinPlatformQuerySchema,
  CoinPurchaseParamsSchema,
  CoinTransferBodySchema,
  CoinTransferQuoteQuerySchema,
  SaveCoinPackBodySchema,
  StartCoinPurchaseBodySchema,
  StoreReceiptBodySchema,
} from "../validators/coins.validator.js";

const COINS = "/api/v1/coins";
const TAG = "coins";

export function registerCoinsRoutes(router: HttpRouter, controller: CoinsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const wallet = guard.requirePermission("wallet:use");
  const moneyMoving = guard.requirePermission("wallet:use", requireIdempotencyKey);
  router.get(`${COINS}/balance`, controller.balance, { ...wallet, ...describeRoute(TAG, "My spendable and earned coin balances") });
  router.get(`${COINS}/packs`, controller.packs, { ...guard.allowAnyone(), ...describeRoute(TAG, "Coin packs priced in my currency") });
  router.get(`${COINS}/packages`, controller.packs, { ...guard.allowAnyone(), ...describeRoute(TAG, "Coin packs priced in my currency (alias of /coins/packs)") });
  router.post(`${COINS}/purchases`, controller.startPurchase, {
    ...moneyMoving,
    ...describeRoute(TAG, "Buy a coin pack: web checkout returns authorizationUrl; store_iap returns the store product to buy (Idempotency-Key required)", {
      query: CoinPlatformQuerySchema, body: StartCoinPurchaseBodySchema,
    }),
  });
  router.post(`${COINS}/purchases/:reference/verify`, controller.verifyPurchase, { ...wallet, ...describeRoute(TAG, "Verify a coin purchase with the provider", { params: CoinPurchaseParamsSchema }) });
  router.post(`${COINS}/iap/receipts`, controller.redeemStoreReceipt, {
    ...moneyMoving,
    ...describeRoute(TAG, "Redeem an App Store / Google Play receipt for coins (501 until configured; Idempotency-Key required)", { body: StoreReceiptBodySchema }),
  });
  router.get(`${COINS}/transactions`, controller.transactions, { ...wallet, ...describeRoute(TAG, "My coin ledger entries", { query: CoinPageQuerySchema }) });
  router.get(`${COINS}/transfers/quote`, controller.quoteTransfer, { ...wallet, ...describeRoute(TAG, "Preview the platform fee on a coin transfer", { query: CoinTransferQuoteQuerySchema }) });
  router.post(`${COINS}/transfers`, controller.transfer, {
    ...moneyMoving,
    ...describeRoute(TAG, "Send coins to another user minus the platform fee (Idempotency-Key required)", { body: CoinTransferBodySchema }),
  });
  const admin = guard.requirePermission("monetization:manage");
  router.get("/api/v1/admin/coin-packs", controller.listPacksForAdmin, { ...admin, ...describeRoute(TAG, "List every coin pack including inactive ones") });
  router.put("/api/v1/admin/coin-packs/:id", controller.savePack, { ...admin, ...describeRoute(TAG, "Create or update a coin pack and its prices", { params: CoinPackParamsSchema, body: SaveCoinPackBodySchema }) });
}
