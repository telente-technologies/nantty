import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

describe("sale attribution", () => {
  it("stores the attribution on the cart item and copies it to the order item at checkout", async () => {
    const buyer = await app.registerBuyer();
    const attributed = await app.createStoreWithProduct({ price: 5_000 });
    const plain = await app.createStoreWithProduct({ price: 2_000 });
    const postId = randomUUID();
    const cart = await app.client
      .post("/api/v1/cart/items")
      .auth(buyer.accessToken)
      .send({ productId: attributed.productId, quantity: 2, attribution: { source: "post", id: postId } })
      .expect(201);
    const line = cart.json<{ items: { product: { id: string }; attribution: unknown }[] }>().items.find((item) => item.product.id === attributed.productId);
    expect(line?.attribution).toEqual({ source: "post", id: postId });
    await app.addToCart(buyer, plain.variantId, 1);

    const placed = await app.checkout(buyer);
    const attributedOrder = placed.orders.find((order) => order.storeId === attributed.storeId);
    const plainOrder = placed.orders.find((order) => order.storeId === plain.storeId);
    const lookup = app.dependencies.ports.orderLookup;
    expect(await lookup.listAttributedOrderItems(attributedOrder?.id ?? "")).toEqual([
      expect.objectContaining({ storeId: attributed.storeId, productId: attributed.productId, quantity: 2, lineTotal: 10_000, currency: "NGN", attributionSource: "post", attributionId: postId }),
    ]);
    expect(await lookup.listAttributedOrderItems(plainOrder?.id ?? "")).toEqual([expect.objectContaining({ attributionSource: null, attributionId: null })]);
    const order = (await app.client.get(`/api/v1/orders/${attributedOrder?.id}`).auth(buyer.accessToken).expect(200)).json<{ items: { attributionSource: string }[] }>();
    expect(order.items[0]?.attributionSource).toBe("post");
  });

  it("keeps the first attribution when the same product is added again without one, and rejects unknown sources", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    const clipId = randomUUID();
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1, attribution: { source: "clip", id: clipId } }).expect(201);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1 }).expect(201);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1, attribution: { source: "banner", id: clipId } }).expect(400);
    const placed = await app.checkout(buyer);
    const items = await app.dependencies.ports.orderLookup.listAttributedOrderItems(placed.orders[0]?.id ?? "");
    expect(items).toEqual([expect.objectContaining({ quantity: 2, attributionSource: "clip", attributionId: clipId })]);
    expect(await app.dependencies.ports.orderLookup.listAttributedOrderItems(randomUUID())).toEqual([]);
  });
});
