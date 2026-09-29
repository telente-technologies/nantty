import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PurchasableVariant } from "../../../src/interfaces/productCatalog.interface.js";
import type { StoreSummary } from "../../../src/interfaces/storeAccess.interface.js";
import { priceCartLine, priceStoreGroup } from "../../../src/modules/carts/services/cartPricing.service.js";
import { CurrencyMismatchError } from "../../../src/utils/money.util.js";
import { createCommerceTestApplication, createIdempotencyKey, type MoneyShape } from "./commerceSetup.fixture.js";

const app = createCommerceTestApplication();
beforeAll(() => app.refreshExchangeRates());
afterAll(() => app.close());

interface BuyerOrder {
  readonly total: MoneyShape;
  readonly storeCurrency: string;
  readonly charged: { total: MoneyShape; exchangeRate: string; rateLockedAt: string };
}

describe("checkout currency and locked exchange rates", () => {
  it("charges a Ghanaian buyer in cedis at the rate locked at checkout, even after rates change", async () => {
    const buyer = await app.registerBuyer("GH");
    const store = await app.createStoreWithProduct({ currency: "NGN", price: 100_000 });
    await app.addToCart(buyer, store.variantId, 1);
    const placed = await app.checkout(buyer);
    const order = placed.orders[0];
    expect(placed.checkout.total).toEqual({ amountMinor: 1_000, currency: "GHS" });
    expect(order?.charged).toMatchObject({ total: { amountMinor: 1_000, currency: "GHS" }, exchangeRate: "0.01" });

    app.exchangeRates.unitsPerUsDollar = { ...app.exchangeRates.unitsPerUsDollar, GHS: "30" };
    await app.refreshExchangeRates();
    const later = (await app.client.get(`/api/v1/orders/${order?.id ?? ""}`).auth(buyer.accessToken).expect(200)).json<BuyerOrder>();
    expect(later.charged).toMatchObject({ total: { amountMinor: 1_000, currency: "GHS" }, exchangeRate: "0.01" });
    expect(later.total).toEqual({ amountMinor: 2_000, currency: "GHS" });
    expect(later.storeCurrency).toBe("NGN");

    await app.payCheckout(buyer, placed.payableOrderId);
    expect(app.paystack.initialized.at(-1)).toMatchObject({ amount: 1_000, currency: "GHS" });
    await app.client.get(`/api/v1/orders/${order?.id ?? ""}/escrow`).auth(buyer.accessToken).expect(200).expectJson({ amount: { amountMinor: 100_000, currency: "NGN" }, status: "held" });
    const sellerView = await app.client.get(`/api/v1/seller/orders/${order?.id ?? ""}`).auth(store.seller.accessToken).expect(200);
    expect(sellerView.json<BuyerOrder>().total).toEqual({ amountMinor: 100_000, currency: "NGN" });
    app.exchangeRates.unitsPerUsDollar = { ...app.exchangeRates.unitsPerUsDollar, GHS: "15" };
    await app.refreshExchangeRates();
  });

  it("falls back to US dollars when neither provider can charge the display currency", async () => {
    const buyer = await app.registerBuyer("GB");
    const store = await app.createStoreWithProduct({ currency: "NGN", price: 150_000 });
    await app.addToCart(buyer, store.variantId, 1);
    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<{ displayCurrency: string; total: MoneyShape }>();
    expect(cart.displayCurrency).toBe("GBP");
    expect(cart.total).toEqual({ amountMinor: 80, currency: "GBP" });
    const placed = await app.checkout(buyer);
    expect(placed.checkout.total).toEqual({ amountMinor: 100, currency: "USD" });
    const payment = await app.client
      .post("/api/v1/payments/initialize")
      .auth(buyer.accessToken)
      .set("idempotency-key", createIdempotencyKey())
      .send({ orderId: placed.payableOrderId, provider: "paystack" })
      .expect(201);
    expect(payment.json<{ payment: { amount: MoneyShape } }>().payment.amount).toEqual({ amountMinor: 100, currency: "USD" });
  });

  it("converts each store's native totals before summing a cart in the viewer's currency", async () => {
    const buyer = await app.registerBuyer("NG");
    const nairaStore = await app.createStoreWithProduct({ currency: "NGN", price: 50_000 });
    const cediStore = await app.createStoreWithProduct({ currency: "GHS", price: 1_000 });
    await app.addToCart(buyer, nairaStore.variantId, 1);
    await app.addToCart(buyer, cediStore.variantId, 1);
    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<{ stores: { total: MoneyShape }[]; total: MoneyShape }>();
    expect(cart.stores.every((group) => group.total.currency === "NGN")).toBe(true);
    expect(cart.total).toEqual({ amountMinor: 150_000, currency: "NGN" });
    const placed = await app.checkout(buyer);
    const nativeTotals = placed.orders.map((order) => order.charged.total);
    expect(nativeTotals.every((total) => total.currency === "NGN")).toBe(true);
    expect(placed.checkout.total).toEqual({ amountMinor: 150_000, currency: "NGN" });
  });

  it("refunds a cross-currency order in the charged currency at the locked rate", async () => {
    const buyer = await app.registerBuyer("GH");
    const admin = await app.registerAdmin();
    const store = await app.createStoreWithProduct({ currency: "NGN", price: 30_000 });
    const placed = await app.buyAndPay(buyer, store);
    const orderId = placed.orders[0]?.id ?? "";
    await app.client.post(`/api/v1/admin/orders/${orderId}/refund`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200).expectJson({ escrow: { status: "refunded" } });
    expect(app.paystack.refunds.at(-1)).toMatchObject({ amount: 300, currency: "GHS" });
  });
});

describe("money safety", () => {
  const store: StoreSummary = {
    id: "store-1", ownerId: "owner-1", name: "Shop", slug: "shop", logoUrl: null, status: "active",
    currency: "NGN", shippingFee: 0, discountBps: 0, ratingAverage: 0, ratingCount: 0,
    description: "", bannerUrl: null, featured: false, createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const variant: PurchasableVariant = {
    variantId: "variant-1", productId: "product-1", storeId: "store-1", title: "Item", size: null, color: null, imageUrl: null,
    unitPrice: 1_000, currency: "USD", stock: 5, purchasable: true,
  };

  it("refuses to add amounts in different currencies inside cart math", () => {
    expect(() => priceStoreGroup(store, [priceCartLine("cart-item-1", variant, 1)])).toThrow(CurrencyMismatchError);
  });
});
