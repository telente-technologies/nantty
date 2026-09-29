import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, naira } from "./commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

const shippingAddress = { fullName: "Ada Buyer", phone: "08031234567", line1: "12 Allen Avenue", city: "Ikeja", state: "Lagos" };

describe("checkout", () => {
  it("creates one order per store with server-computed totals and empties the cart", async () => {
    const buyer = await app.registerBuyer();
    const first = await app.createStoreWithProduct({ price: 10_000, shippingFee: 1_000, discountBps: 500 });
    const second = await app.createStoreWithProduct({ price: 3_000 });
    await app.addToCart(buyer, first.variantId, 2);
    await app.addToCart(buyer, second.variantId, 1);
    const placed = await app.checkout(buyer);
    expect(placed.orders).toHaveLength(2);
    expect(placed.checkout.total).toEqual(naira(20_000 - 1_000 + 1_000 + 3_000));
    expect(placed.orders.every((order) => order.status === "pending_payment")).toBe(true);
    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<{ stores: unknown[] }>();
    expect(cart.stores).toHaveLength(0);
  });

  it("requires an Idempotency-Key and replays the first response for the same key", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    await app.addToCart(buyer, store.variantId, 1);
    await app.client.post("/api/v1/checkout").auth(buyer.accessToken).send({ shippingAddress }).expect(400);
    const key = createIdempotencyKey();
    const first = await app.client.post("/api/v1/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ shippingAddress }).expect(201);
    const replay = await app.client.post("/api/v1/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ shippingAddress }).expect(201);
    expect(replay.header("idempotent-replayed")).toBe("true");
    expect(replay.json()).toEqual(first.json());
    await app.client.post("/api/v1/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ shippingAddress: { ...shippingAddress, city: "Yaba" } }).expect(422);
  });

  it("rejects an empty cart and reserves stock", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ stock: 3 });
    await app.client.post("/api/v1/checkout").auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ shippingAddress }).expect(422);
    await app.addToCart(buyer, store.variantId, 3);
    await app.checkout(buyer);
    const other = await app.registerBuyer();
    await app.client.post("/api/v1/cart/items").auth(other.accessToken).send({ variantId: store.variantId, quantity: 1 }).expect(422);
  });
});

describe("order access and lifecycle", () => {
  it("lets only the buyer see their order and only store members manage it", async () => {
    const buyer = await app.registerBuyer();
    const stranger = await app.registerBuyer();
    const otherSeller = await app.registerSeller();
    const store = await app.createStoreWithProduct();
    const placed = await app.buyAndPay(buyer, store);
    const orderId = placed.orders[0]?.id ?? "";
    await app.client.get(`/api/v1/orders/${orderId}`).auth(buyer.accessToken).expect(200).expectJson({ status: "paid", displayStatus: "Pending" });
    await app.client.get(`/api/v1/orders/${orderId}`).auth(stranger.accessToken).expect(404);
    await app.client.get(`/api/v1/stores/${store.storeId}/orders`).auth(otherSeller.accessToken).expect(403);
    await app.client.post(`/api/v1/stores/${store.storeId}/orders/${orderId}/ship`).auth(otherSeller.accessToken).send({}).expect(403);
    await app.client.get(`/api/v1/stores/${store.storeId}/orders/${orderId}`).auth(store.seller.accessToken).expect(200).expectJson({ shippingAddress: { phone: "+2348031234567" } });
  });

  it("moves through paid, shipped and delivered and filters buyer lists", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    const placed = await app.buyAndPay(buyer, store);
    const orderId = placed.orders[0]?.id ?? "";
    const base = `/api/v1/stores/${store.storeId}/orders/${orderId}`;
    await app.client.post(`${base}/deliver`).auth(store.seller.accessToken).expect(409);
    await app.client.post(`${base}/ship`).auth(store.seller.accessToken).send({ trackingNumber: "GIG-123" }).expect(200).expectJson({ status: "shipped", trackingNumber: "GIG-123" });
    const shipped = (await app.client.get("/api/v1/orders").query({ status: "shipped" }).auth(buyer.accessToken).expect(200)).json<{ items: { id: string }[] }>();
    expect(shipped.items.map((order) => order.id)).toEqual([orderId]);
    await app.client.post(`${base}/deliver`).auth(store.seller.accessToken).expect(200).expectJson({ status: "delivered", displayStatus: "Delivered" });
    await app.client.post(`/api/v1/orders/${orderId}/cancel`).auth(buyer.accessToken).expect(409);
  });

  it("cancels an unpaid order and releases its stock", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ stock: 1 });
    await app.addToCart(buyer, store.variantId, 1);
    const placed = await app.checkout(buyer);
    const orderId = placed.orders[0]?.id ?? "";
    await app.client.post(`/api/v1/orders/${orderId}/cancel`).auth(buyer.accessToken).expect(200).expectJson({ status: "cancelled" });
    await app.addToCart(buyer, store.variantId, 1);
  });
});

describe("seller dashboard", () => {
  it("reports sales buckets, hourly series, recent orders and inventory", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ price: 4_000, stock: 12 });
    await app.buyAndPay(buyer, store, 2);
    const dashboard = (await app.client.get(`/api/v1/stores/${store.storeId}/dashboard`).auth(store.seller.accessToken).expect(200)).json<{
      sales: Record<string, { amountMinor: number; currency: string }>;
      orderCount: number;
      hourlySales: { hour: number; amount: { amountMinor: number } }[];
      recentOrders: unknown[];
      inventory: { stock: number }[];
    }>();
    expect(dashboard.sales).toMatchObject({ live: naira(8_000), today: naira(8_000), yesterday: naira(0), thisMonth: naira(8_000) });
    expect(dashboard.orderCount).toBe(1);
    expect(dashboard.hourlySales).toHaveLength(24);
    expect(dashboard.hourlySales.reduce((total, point) => total + point.amount.amountMinor, 0)).toBe(8_000);
    expect(dashboard.recentOrders).toHaveLength(1);
    expect(dashboard.inventory[0]?.stock).toBe(10);
    const buyerAttempt = await app.client.get(`/api/v1/stores/${store.storeId}/dashboard`).auth(buyer.accessToken);
    expect([403]).toContain(buyerAttempt.status);
  });
});
