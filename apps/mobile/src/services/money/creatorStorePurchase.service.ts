import type { Purchase } from "expo-iap";

import type { CreatorStorePurchaseIntent, CreatorSubscriptionState } from "@/types/creator.type";

import { generateIdempotencyKey } from "../core/apiClient.service";
import { creatorProgramService } from "../creators/creatorProgram.service";
import { isCreatorStoreProduct, type StoreBillingModule } from "./nativeStoreBilling.service";

const ACTIVATION_POLL_ATTEMPTS = 6;
const ACTIVATION_POLL_DELAY_MS = 1_500;

export class StorePurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled.");
  }
}

export interface CreatorStorePurchaseDependencies {
  readonly billing: StoreBillingModule;
  readonly platform: "ios" | "android";
  readonly api?: Pick<typeof creatorProgramService, "startStoreSubscription" | "redeemStoreSubscriptionReceipt" | "fetchSubscriptionState">;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

const waitForMilliseconds = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function fetchStoreDisplayPrice(billing: StoreBillingModule, productId: string): Promise<string | null> {
  const products = await billing.fetchProducts({ skus: [productId], type: "subs" });
  const product = (products ?? []).find((candidate) => candidate.id === productId);
  return product?.displayPrice ?? null;
}

function waitForStorePurchase(billing: StoreBillingModule, productId: string): { readonly result: Promise<Purchase>; readonly stop: () => void } {
  let stop = () => {};
  const result = new Promise<Purchase>((resolve, reject) => {
    const updated = billing.purchaseUpdatedListener((purchase) => {
      if (purchase.productId === productId) resolve(purchase);
    });
    const failed = billing.purchaseErrorListener((error) => {
      reject(billing.isUserCancelledError(error) ? new StorePurchaseCancelledError() : new Error(error.message || "The store couldn't complete the purchase."));
    });
    stop = () => {
      updated.remove();
      failed.remove();
    };
  });
  return { result, stop };
}

async function androidOfferToken(billing: StoreBillingModule, productId: string): Promise<string | null> {
  const products = await billing.fetchProducts({ skus: [productId], type: "subs" });
  const product = (products ?? []).find((candidate) => candidate.id === productId);
  const offers = product && "subscriptionOffers" in product ? product.subscriptionOffers : [];
  return offers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid ?? null;
}

async function redeemAndFinish(dependencies: CreatorStorePurchaseDependencies, purchase: Purchase): Promise<CreatorSubscriptionState> {
  const api = dependencies.api ?? creatorProgramService;
  const receipt = purchase.purchaseToken ?? "";
  const state = await api.redeemStoreSubscriptionReceipt(
    { platform: dependencies.platform, productId: purchase.productId, receipt, transactionId: (dependencies.platform === "ios" && "transactionId" in purchase ? purchase.transactionId : null) ?? "" },
    generateIdempotencyKey(),
  );
  await dependencies.billing.finishTransaction({ purchase, isConsumable: false });
  return state;
}

async function pollUntilActive(dependencies: CreatorStorePurchaseDependencies, state: CreatorSubscriptionState): Promise<CreatorSubscriptionState> {
  const api = dependencies.api ?? creatorProgramService;
  const wait = dependencies.wait ?? waitForMilliseconds;
  let latest = state;
  for (let attempt = 0; attempt < ACTIVATION_POLL_ATTEMPTS && latest.status === "pending"; attempt++) {
    await wait(ACTIVATION_POLL_DELAY_MS * (attempt + 1));
    latest = await api.fetchSubscriptionState(latest.subscriptionId).catch(() => latest);
  }
  return latest;
}

export async function purchaseCreatorSubscriptionInStore(
  dependencies: CreatorStorePurchaseDependencies,
  creatorId: string,
  planId: string,
  idempotencyKey: string,
): Promise<CreatorSubscriptionState> {
  const { billing, platform } = dependencies;
  const api = dependencies.api ?? creatorProgramService;
  await billing.initConnection();
  const intent: CreatorStorePurchaseIntent = await api.startStoreSubscription(creatorId, planId, platform, idempotencyKey);
  const offerToken = platform === "android" ? await androidOfferToken(billing, intent.productId) : null;
  if (platform === "android" && !offerToken) throw new Error("This subscription isn't available in Google Play yet.");
  const pending = waitForStorePurchase(billing, intent.productId);
  try {
    await billing.requestPurchase({
      type: "subs",
      request: {
        apple: { sku: intent.productId, appAccountToken: intent.appAccountToken },
        google: { skus: [intent.productId], obfuscatedAccountId: intent.obfuscatedAccountId, subscriptionOffers: offerToken ? [{ sku: intent.productId, offerToken }] : [] },
      },
    });
    const purchase = await pending.result;
    return pollUntilActive(dependencies, await redeemAndFinish(dependencies, purchase));
  } finally {
    pending.stop();
  }
}

export async function restoreCreatorStoreSubscriptions(dependencies: CreatorStorePurchaseDependencies): Promise<readonly CreatorSubscriptionState[]> {
  const { billing } = dependencies;
  await billing.initConnection();
  if (dependencies.platform === "ios") await billing.restorePurchases();
  const purchases = (await billing.getAvailablePurchases()).filter((purchase) => isCreatorStoreProduct(purchase.productId));
  const restored: CreatorSubscriptionState[] = [];
  for (const purchase of purchases) {
    try {
      restored.push(await redeemAndFinish(dependencies, purchase));
    } catch {
      continue;
    }
  }
  return restored;
}
