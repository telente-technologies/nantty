import type { Product, Purchase } from "expo-iap";

import type { CoinPackage } from "@/types/social.type";

import {
  CoinStorePurchaseCancelledError,
  fetchCoinStorePrices,
  purchaseCoinStoreProduct,
} from "../money/coinStorePurchase.service";
import type { StoreBillingModule } from "../money/nativeStoreBilling.service";

const STORE_PRODUCT = "com.nantty.coins.small";

function coinPackage(storeProductId: string | null): CoinPackage {
  return {
    id: "package-small",
    coins: 100,
    price: { amountMinor: 150_000, currency: "NGN" },
    purchaseChannel: "store_iap",
    storeProductId,
  };
}

function fakeBilling(options: { readonly purchaseState?: Purchase["purchaseState"]; readonly hasReceipt?: boolean } = {}) {
  const updated: ((purchase: Purchase) => void)[] = [];
  const failed: ((error: { message: string; code: string }) => void)[] = [];
  const removed = jest.fn();
  const purchase = {
    id: "GPA.1234-5678-9012-34567",
    transactionId: "2000000123456789",
    productId: STORE_PRODUCT,
    purchaseToken: options.hasReceipt === false ? null : "store-signed-receipt",
    purchaseState: options.purchaseState ?? "purchased",
  } as unknown as Purchase;
  const billing = {
    initConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(async () => [{ id: STORE_PRODUCT, displayPrice: "₦1,500" } as Product]),
    purchaseUpdatedListener: jest.fn((listener: (purchase: Purchase) => void) => { updated.push(listener); return { remove: removed }; }),
    purchaseErrorListener: jest.fn((listener: (error: { message: string; code: string }) => void) => { failed.push(listener); return { remove: removed }; }),
    isUserCancelledError: jest.fn((error: { code: string }) => error.code === "user-cancelled"),
    requestPurchase: jest.fn(async () => {
      updated.forEach((listener) => listener({ ...purchase, purchaseState: "pending" } as Purchase));
      updated.forEach((listener) => listener(purchase));
      return null;
    }),
    finishTransaction: jest.fn(async () => undefined),
  };
  return { billing: billing as unknown as StoreBillingModule, mocks: billing, updated, failed, removed, purchase };
}

describe("coin store purchases", () => {
  it("loads localized store prices for distinct configured coin products", async () => {
    const { billing, mocks } = fakeBilling();
    const prices = await fetchCoinStorePrices(billing, [coinPackage(STORE_PRODUCT), coinPackage(STORE_PRODUCT), coinPackage(null)]);

    expect(mocks.fetchProducts).toHaveBeenCalledWith({ skus: [STORE_PRODUCT], type: "in-app" });
    expect(prices).toEqual({ [STORE_PRODUCT]: "₦1,500" });
  });

  it("sends the verified store receipt to Nantty before finishing the consumable purchase", async () => {
    const { billing, mocks, removed } = fakeBilling();
    const api = { redeemStoreReceipt: jest.fn(async () => ({ status: "succeeded", coins: 125 })) };

    await expect(purchaseCoinStoreProduct(billing, "ios", STORE_PRODUCT, api)).resolves.toEqual({ status: "succeeded", coins: 125 });

    expect(mocks.requestPurchase).toHaveBeenCalledWith({ type: "in-app", request: { apple: { sku: STORE_PRODUCT }, google: { skus: [STORE_PRODUCT] } } });
    expect(api.redeemStoreReceipt).toHaveBeenCalledWith({
      platform: "ios",
      productId: STORE_PRODUCT,
      receipt: "store-signed-receipt",
      transactionId: "2000000123456789",
    });
    expect(mocks.finishTransaction).toHaveBeenCalledWith({ purchase: expect.objectContaining({ productId: STORE_PRODUCT }), isConsumable: true });
    expect(removed).toHaveBeenCalledTimes(2);
  });

  it.each(["pending", "failed"] as const)("does not finish a store transaction when server verification is %s", async (status) => {
    const { billing, mocks } = fakeBilling();
    const api = { redeemStoreReceipt: jest.fn(async () => ({ status, coins: 0 })) };

    await expect(purchaseCoinStoreProduct(billing, "android", STORE_PRODUCT, api)).resolves.toEqual({ status, coins: 0 });

    expect(mocks.finishTransaction).not.toHaveBeenCalled();
  });

  it("does not redeem or finish a purchase without the store receipt", async () => {
    const { billing, mocks } = fakeBilling({ hasReceipt: false });
    const api = { redeemStoreReceipt: jest.fn() };

    await expect(purchaseCoinStoreProduct(billing, "android", STORE_PRODUCT, api)).resolves.toEqual({ status: "failed", coins: 0 });

    expect(api.redeemStoreReceipt).not.toHaveBeenCalled();
    expect(mocks.finishTransaction).not.toHaveBeenCalled();
  });

  it("reports user cancellation without redeeming or acknowledging a purchase", async () => {
    const { billing, mocks, failed } = fakeBilling();
    mocks.requestPurchase.mockImplementationOnce(async () => {
      failed.forEach((listener) => listener({ message: "cancelled", code: "user-cancelled" }));
      return null;
    });
    const api = { redeemStoreReceipt: jest.fn() };

    await expect(purchaseCoinStoreProduct(billing, "ios", STORE_PRODUCT, api)).rejects.toBeInstanceOf(CoinStorePurchaseCancelledError);

    expect(api.redeemStoreReceipt).not.toHaveBeenCalled();
    expect(mocks.finishTransaction).not.toHaveBeenCalled();
  });

  it("removes listeners when the native purchase request itself fails", async () => {
    const { billing, mocks, removed } = fakeBilling();
    mocks.requestPurchase.mockRejectedValueOnce(new Error("store unavailable"));

    await expect(purchaseCoinStoreProduct(billing, "android", STORE_PRODUCT, { redeemStoreReceipt: jest.fn() })).rejects.toThrow("store unavailable");

    expect(removed).toHaveBeenCalledTimes(2);
  });
});
