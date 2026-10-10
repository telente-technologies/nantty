import type { Purchase } from "expo-iap";

import type { CreatorSubscriptionState } from "@/types/creator.type";

import { purchaseCreatorSubscriptionInStore, restoreCreatorStoreSubscriptions, StorePurchaseCancelledError } from "../money/creatorStorePurchase.service";
import type { StoreBillingModule } from "../money/nativeStoreBilling.service";

jest.mock("../core/apiClient.service", () => ({ generateIdempotencyKey: () => "receipt-key", api: {} }));

const PRODUCT = "zudomart.creatorsub.tier_1000.s2.monthly";

const state = (status: CreatorSubscriptionState["status"]): CreatorSubscriptionState => ({
  subscriptionId: "sub-1", creatorId: "creator-1", planId: "plan-1", status, price: { amountMinor: 100_000, currency: "NGN" }, interval: "month",
  currentPeriodEnd: null, renewsAt: null, billingChannel: "apple_iap",
});

function fakeBilling(outcome: "purchase" | "cancel", platform: "ios" | "android") {
  const updated: ((purchase: Purchase) => void)[] = [];
  const failed: ((error: { message: string; code: string }) => void)[] = [];
  const removed = jest.fn();
  const purchase = { id: "2000000123", transactionId: "2000000123", productId: PRODUCT, purchaseToken: platform === "ios" ? "signed.jws.value" : "play-token" } as unknown as Purchase;
  const billing = {
    initConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(async () => [{ id: PRODUCT, displayPrice: "₦1,500", subscriptionOffers: [{ offerTokenAndroid: "offer-token" }] }]),
    purchaseUpdatedListener: jest.fn((listener: (purchase: Purchase) => void) => { updated.push(listener); return { remove: removed }; }),
    purchaseErrorListener: jest.fn((listener: (error: { message: string; code: string }) => void) => { failed.push(listener); return { remove: removed }; }),
    isUserCancelledError: jest.fn((error: { code: string }) => error.code === "user-cancelled"),
    requestPurchase: jest.fn(async () => {
      if (outcome === "purchase") updated.forEach((listener) => listener(purchase));
      else failed.forEach((listener) => listener({ message: "cancelled", code: "user-cancelled" }));
      return null;
    }),
    finishTransaction: jest.fn(async () => undefined),
    restorePurchases: jest.fn(async () => undefined),
    getAvailablePurchases: jest.fn(async () => [purchase, { ...purchase, productId: "com.zudomart.app.coins.tier1" }]),
  };
  return { billing: billing as unknown as StoreBillingModule, mocks: billing, removed };
}

function fakeApi(statuses: CreatorSubscriptionState["status"][]) {
  return {
    startStoreSubscription: jest.fn(async () => ({
      subscriptionId: "sub-1", platform: "ios" as const, productId: PRODUCT, appAccountToken: "0199a3f2-0000-7000-8000-000000000001",
      obfuscatedAccountId: "0199a3f2-0000-7000-8000-000000000001", channelPrice: { amountMinor: 150_000, currency: "NGN" }, subscription: state("pending"),
    })),
    redeemStoreSubscriptionReceipt: jest.fn(async () => state(statuses.shift() ?? "active")),
    fetchSubscriptionState: jest.fn(async () => state(statuses.shift() ?? "active")),
  };
}

describe("creator subscriptions bought in the app store", () => {
  it("buys on iOS with the app account token, sends the signed transaction and polls until active", async () => {
    const { billing, mocks, removed } = fakeBilling("purchase", "ios");
    const api = fakeApi(["pending", "pending", "active"]);
    const result = await purchaseCreatorSubscriptionInStore({ billing, platform: "ios", api, wait: async () => undefined }, "creator-1", "plan-1", "intent-key");
    expect(result.status).toBe("active");
    expect(api.startStoreSubscription).toHaveBeenCalledWith("creator-1", "plan-1", "ios", "intent-key");
    expect(mocks.requestPurchase).toHaveBeenCalledWith(expect.objectContaining({ type: "subs", request: expect.objectContaining({ apple: { sku: PRODUCT, appAccountToken: "0199a3f2-0000-7000-8000-000000000001" } }) }));
    expect(api.redeemStoreSubscriptionReceipt).toHaveBeenCalledWith({ platform: "ios", productId: PRODUCT, receipt: "signed.jws.value", transactionId: "2000000123" }, "receipt-key");
    expect(mocks.finishTransaction).toHaveBeenCalledWith(expect.objectContaining({ isConsumable: false }));
    expect(api.fetchSubscriptionState).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledTimes(2);
  });

  it("passes the Play offer token and obfuscated account id on Android", async () => {
    const { billing, mocks } = fakeBilling("purchase", "android");
    const api = fakeApi(["active"]);
    await purchaseCreatorSubscriptionInStore({ billing, platform: "android", api, wait: async () => undefined }, "creator-1", "plan-1", "intent-key");
    const request = (mocks.requestPurchase.mock.calls[0] as unknown as [{ request: { google: unknown } }])[0].request.google;
    expect(request).toEqual({ skus: [PRODUCT], obfuscatedAccountId: "0199a3f2-0000-7000-8000-000000000001", subscriptionOffers: [{ sku: PRODUCT, offerToken: "offer-token" }] });
    expect(api.redeemStoreSubscriptionReceipt).toHaveBeenCalledWith(expect.objectContaining({ platform: "android", receipt: "play-token", transactionId: "" }), "receipt-key");
  });

  it("reports a cancelled purchase without sending anything to the server", async () => {
    const { billing, mocks, removed } = fakeBilling("cancel", "ios");
    const api = fakeApi([]);
    await expect(purchaseCreatorSubscriptionInStore({ billing, platform: "ios", api }, "creator-1", "plan-1", "intent-key")).rejects.toBeInstanceOf(StorePurchaseCancelledError);
    expect(api.redeemStoreSubscriptionReceipt).not.toHaveBeenCalled();
    expect(mocks.finishTransaction).not.toHaveBeenCalled();
    expect(removed).toHaveBeenCalledTimes(2);
  });

  it("refuses an Android plan that Play has no offer for", async () => {
    const { billing, mocks } = fakeBilling("purchase", "android");
    mocks.fetchProducts.mockResolvedValueOnce([]);
    await expect(purchaseCreatorSubscriptionInStore({ billing, platform: "android", api: fakeApi([]) }, "creator-1", "plan-1", "intent-key")).rejects.toThrow("isn't available in Google Play");
    expect(mocks.requestPurchase).not.toHaveBeenCalled();
  });

  it("restores only creator subscription purchases and keeps going past a failed one", async () => {
    const { billing, mocks } = fakeBilling("purchase", "ios");
    const api = fakeApi(["active"]);
    expect(await restoreCreatorStoreSubscriptions({ billing, platform: "ios", api })).toHaveLength(1);
    expect(mocks.restorePurchases).toHaveBeenCalled();
    expect(api.redeemStoreSubscriptionReceipt).toHaveBeenCalledTimes(1);
    api.redeemStoreSubscriptionReceipt.mockRejectedValueOnce(new Error("STORE_PURCHASE_NOT_LINKED"));
    expect(await restoreCreatorStoreSubscriptions({ billing, platform: "ios", api })).toHaveLength(0);
  });
});
