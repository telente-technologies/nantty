import type { Product, Purchase } from "expo-iap";

import type { CoinPackage } from "@/types/social.type";

import type { StoreBillingModule } from "./nativeStoreBilling.service";

const STORE_PURCHASE_TIMEOUT_MS = 5 * 60_000;

export class CoinStorePurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled.");
  }
}

export interface CoinStoreReceiptInput {
  readonly platform: "ios" | "android";
  readonly productId: string;
  readonly receipt: string;
  readonly transactionId: string;
}

export interface CoinStorePurchaseApi {
  readonly redeemStoreReceipt: (input: CoinStoreReceiptInput) => Promise<{ readonly status: string; readonly coins: number }>;
}

export async function fetchCoinStorePrices(
  billing: StoreBillingModule,
  packages: readonly CoinPackage[],
): Promise<Readonly<Record<string, string>>> {
  const skus = [...new Set(packages.map((item) => item.storeProductId).filter((id): id is string => Boolean(id)))];
  if (skus.length === 0) return {};
  await billing.initConnection();
  const products = (await billing.fetchProducts({ skus, type: "in-app" })) as Product[] | null;
  return Object.fromEntries((products ?? []).flatMap((product) => product.displayPrice ? [[product.id, product.displayPrice]] : []));
}

function waitForPurchase(billing: StoreBillingModule, productId: string): { readonly result: Promise<Purchase>; readonly stop: () => void } {
  let stop = () => {};
  const result = new Promise<Purchase>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("The store did not confirm this purchase in time. Check your coin balance before trying again.")), STORE_PURCHASE_TIMEOUT_MS);
    const updated = billing.purchaseUpdatedListener((purchase) => {
      if (purchase.productId === productId && purchase.purchaseState === "purchased") {
        clearTimeout(timeout);
        resolve(purchase);
      }
    });
    const failed = billing.purchaseErrorListener((error) => {
      clearTimeout(timeout);
      reject(billing.isUserCancelledError(error) ? new CoinStorePurchaseCancelledError() : new Error(error.message || "The store could not complete the purchase."));
    });
    stop = () => {
      clearTimeout(timeout);
      updated.remove();
      failed.remove();
    };
  });
  return { result, stop };
}

export async function purchaseCoinStoreProduct(
  billing: StoreBillingModule,
  platform: "ios" | "android",
  productId: string,
  api: CoinStorePurchaseApi,
): Promise<{ readonly status: "succeeded" | "pending" | "failed"; readonly coins: number }> {
  await billing.initConnection();
  const pending = waitForPurchase(billing, productId);
  try {
    const purchaseResult = pending.result;
    void purchaseResult.catch(() => undefined);
    await billing.requestPurchase({
      type: "in-app",
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
    });
    const purchase = await purchaseResult;
    if (purchase.productId !== productId || purchase.purchaseState !== "purchased") return { status: "failed", coins: 0 };
    const receipt = purchase.purchaseToken ?? "";
    const transactionId = platform === "ios" ? ("transactionId" in purchase ? purchase.transactionId : null) ?? purchase.id : purchase.id;
    if (!receipt || !transactionId) return { status: "failed", coins: 0 };
    const verified = await api.redeemStoreReceipt({
      platform,
      productId: purchase.productId,
      receipt,
      transactionId,
    });
    if (verified.status === "succeeded") {
      await billing.finishTransaction({ purchase, isConsumable: true });
      return { status: "succeeded", coins: verified.coins };
    }
    return { status: verified.status === "pending" ? "pending" : "failed", coins: 0 };
  } finally {
    pending.stop();
  }
}
