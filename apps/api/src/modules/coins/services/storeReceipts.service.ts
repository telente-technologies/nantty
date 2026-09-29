import { CurrencyCode } from "../../../enums/currency.enum.js";
import { invalidState, unprocessable } from "../../../errors/domain.error.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import type { StoreReceiptVerifier } from "../gateways/storeReceiptVerifier.gateway.js";
import { countCoinsInPack, type InAppPurchaseStore } from "../models/coins.model.js";
import { chooseCoinPurchaseChannel } from "./coinPurchaseChannel.service.js";
import type { CoinPurchasesService, VerifiedCoinPurchase } from "./coinPurchases.service.js";

export interface StoreReceiptRequest {
  readonly userId: string;
  readonly platform: "ios" | "android";
  readonly countryCode: string | null;
  readonly productId: string;
  readonly receipt: string;
  readonly transactionId: string | undefined;
}

export class StoreReceiptsService {
  public constructor(private readonly purchases: CoinPurchasesService, private readonly verifiers: Readonly<Record<InAppPurchaseStore, StoreReceiptVerifier>>) {}

  public async redeemStoreReceipt(request: StoreReceiptRequest): Promise<VerifiedCoinPurchase> {
    const { settings, packs, purchases, coinLedger, audit } = this.purchases.dependencies;
    if (chooseCoinPurchaseChannel(settings, request.platform, request.countryCode) !== "store_iap") {
      throw invalidState("In-app coin purchases are not enabled here; buy coins with web checkout instead.");
    }
    const store: InAppPurchaseStore = request.platform === "ios" ? "apple" : "google";
    const verified = await this.verifiers[store].verifyPurchaseReceipt({ userId: request.userId, productId: request.productId, receipt: request.receipt, transactionId: request.transactionId });
    if (!verified.valid) {
      await audit.record({ actorId: request.userId, action: "coins.store_receipt_rejected", entityType: "user", entityId: request.userId, metadata: { store, reason: verified.failureReason } });
      throw unprocessable("This purchase receipt could not be verified.");
    }
    const pack = await packs.findPackByStoreProductId(verified.productId);
    if (pack === undefined) throw unprocessable("This store product is not a coin pack.");
    const reference = `zmiap_${store}_${verified.transactionId}`;
    const existing = await purchases.findByReference(reference);
    if (existing !== undefined) {
      if (existing.userId !== request.userId) throw invalidState("This purchase receipt was already redeemed by another account.");
      return { purchase: existing, balance: await coinLedger.readCoinBalance(request.userId) };
    }
    const currency = verified.priceCurrency ?? CurrencyCode.USD;
    const amount = verified.priceAmount ?? pack.prices[currency] ?? 0;
    if (amount <= 0) throw unprocessable("The store did not report a price for this purchase.");
    const purchase = await purchases.create({
      userId: request.userId, packId: pack.id, coins: countCoinsInPack(pack), channel: "store_iap", platform: request.platform, provider: store, reference, amount, currency,
    });
    const credited = await this.purchases.creditVerifiedPurchase(purchase, MonetizationLedgerAccounts.storeInAppPurchaseClearing(store, currency), verified.transactionId);
    return { purchase: credited, balance: await coinLedger.readCoinBalance(request.userId) };
  }
}
