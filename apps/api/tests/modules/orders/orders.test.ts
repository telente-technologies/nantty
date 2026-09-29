import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, naira } from "./commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

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
    expect(placed.orders.every((order) => order.status === "pending")).toBe(true);
    expect(placed.orders.map((order) => order.id)).toContain(placed.payableOrderId);
    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<{ items: unknown[] }>();
    expect(cart.items).toHaveLength(0);
  });

  it("requires an Idempotency-Key and replays the first response for the same key", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    await app.addToCart(buyer, store.variantId, 1);
    const addressId = await app.findOrCreateShippingAddressId(buyer);
    await app.client.post("/api/v1/orders/checkout").auth(buyer.accessToken).send({ addressId }).expect(400);
    const key = createIdempotencyKey();
    const first = await app.client.post("/api/v1/orders/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ addressId }).expect(201);
    const replay = await app.client.post("/api/v1/orders/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ addressId }).expect(201);
    expect(replay.header("idempotent-replayed")).toBe("true");
    expect(replay.json()).toEqual(first.json());
    const otherAddressId = (await app.client.post("/api/v1/users/me/addresses").auth(buyer.accessToken).send({ fullName: "Ada", phone: "08031234567", line1: "3 Broad Street", city: "Yaba", state: "Lagos" }).expect(201)).json<{ id: string }>().id;
    await app.client.post("/api/v1/orders/checkout").auth(buyer.accessToken).set("idempotency-key", key).send({ addressId: otherAddressId }).expect(422);
    const stranger = await app.registerBuyer();
    await app.addToCart(stranger, store.variantId, 1);
    await app.client.post("/api/v1/orders/checkout").auth(stranger.accessToken).set("idempotency-key", createIdempotencyKey()).send({ addressId }).expect(404);
  });

  it("rejects an empty cart and reserves stock", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ stock: 3 });
    await app.client.post("/api/v1/orders/checkout").auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ addressId: await app.findOrCreateShippingAddressId(buyer) }).expect(422);
    await app.addToCart(buyer, store.variantId, 3);
    await app.checkout(buyer);
    const other = await app.registerBuyer();
    await app.client.post("/api/v1/cart/items").auth(other.accessToken).send({ productId: store.productId, quantity: 1 }).expect(422);
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
    await app.client.get("/api/v1/seller/orders").query({ storeId: store.storeId }).auth(otherSeller.accessToken).expect(403);
    await app.client.get("/api/v1/seller/orders").auth(otherSeller.accessToken).expect(404);
    await app.client.post(`/api/v1/seller/orders/${orderId}/ship`).auth(otherSeller.accessToken).send({}).expect(403);
    await app.client.get(`/api/v1/seller/orders/${orderId}`).auth(store.seller.accessToken).expect(200).expectJson({ shippingAddress: { phone: "+2348031234567" }, customerName: "Ada Buyer" });
    const found = (await app.client.get("/api/v1/seller/orders").query({ q: "ada buyer", status: "paid" }).auth(store.seller.accessToken).expect(200)).json<{ data: { id: string }[] }>();
    expect(found.data.map((order) => order.id)).toEqual([orderId]);
  });

  it("moves through paid, shipped and delivered and filters buyer lists", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    const placed = await app.buyAndPay(buyer, store);
    const orderId = placed.orders[0]?.id ?? "";
    const base = `/api/v1/seller/orders/${orderId}`;
    await app.client.post(`${base}/deliver`).auth(store.seller.accessToken).expect(409);
    await app.client.post(`${base}/ship`).auth(store.seller.accessToken).send({ trackingNumber: "GIG-123" }).expect(200).expectJson({ status: "shipped", trackingNumber: "GIG-123" });
    const shipped = (await app.client.get("/api/v1/orders").query({ status: "shipped" }).auth(buyer.accessToken).expect(200)).json<{ data: { id: string }[] }>();
    expect(shipped.data.map((order) => order.id)).toEqual([orderId]);
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
  it("reports sales for a period, a chart series, recent orders and inventory for my store", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ price: 4_000, stock: 12 });
    await app.buyAndPay(buyer, store, 2);
    type Dashboard = {
      totalSales: { amountMinor: number; currency: string };
      orderCount: number;
      sales: Record<string, { amountMinor: number; currency: string }>;
      chart: { label: string; amount: { amountMinor: number } }[];
      recentOrders: unknown[];
      inventory: { stock: number }[];
    };
    const today = (await app.client.get("/api/v1/seller/dashboard").query({ period: "today" }).auth(store.seller.accessToken).expect(200)).json<Dashboard>();
    expect(today.totalSales).toEqual(naira(8_000));
    expect(today.orderCount).toBe(1);
    expect(today.sales).toMatchObject({ live: naira(8_000), today: naira(8_000), yesterday: naira(0), month: naira(8_000) });
    expect(today.chart).toHaveLength(24);
    expect(today.chart.reduce((total, point) => total + point.amount.amountMinor, 0)).toBe(8_000);
    expect(today.recentOrders).toHaveLength(1);
    expect(today.inventory[0]?.stock).toBe(10);
    const yesterday = (await app.client.get("/api/v1/seller/dashboard").query({ period: "yesterday" }).auth(store.seller.accessToken).expect(200)).json<Dashboard>();
    expect(yesterday.totalSales).toEqual(naira(0));
    const allTime = (await app.client.get("/api/v1/seller/dashboard").query({ period: "all" }).auth(store.seller.accessToken).expect(200)).json<Dashboard>();
    expect(allTime.chart).toHaveLength(12);
    await app.client.get("/api/v1/seller/dashboard").auth(buyer.accessToken).expect(403);
  });
});
