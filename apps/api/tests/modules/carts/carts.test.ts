import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, naira, type MoneyShape } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

interface CartBody {
  readonly displayCurrency: string;
  readonly stores: { store: { id: string }; items: { quantity: number; lineTotal: MoneyShape }[]; itemsTotal: MoneyShape; shopDiscount: MoneyShape; shipping: MoneyShape; total: MoneyShape }[];
  readonly summary: { itemsTotal: MoneyShape; shopDiscount: MoneyShape; shipping: MoneyShape; estimatedTotal: MoneyShape };
}

describe("cart totals", () => {
  it("computes items, shop discount, shipping and total per store and overall", async () => {
    const buyer = await app.registerBuyer();
    const first = await app.createStoreWithProduct({ price: 10_000, stock: 12, shippingFee: 1_500, discountBps: 1_000 });
    const second = await app.createStoreWithProduct({ price: 2_599, stock: 5, shippingFee: 700 });
    await app.addToCart(buyer, first.variantId, 3);
    await app.addToCart(buyer, second.variantId, 2);

    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<CartBody>();
    const firstGroup = cart.stores.find((group) => group.store.id === first.storeId);
    expect(firstGroup).toMatchObject({ itemsTotal: naira(30_000), shopDiscount: naira(3_000), shipping: naira(1_500), total: naira(28_500) });
    const secondGroup = cart.stores.find((group) => group.store.id === second.storeId);
    expect(secondGroup).toMatchObject({ itemsTotal: naira(5_198), shopDiscount: naira(0), shipping: naira(700), total: naira(5_898) });
    expect(cart.displayCurrency).toBe("NGN");
    expect(cart.summary).toEqual({ itemsTotal: naira(35_198), shopDiscount: naira(3_000), shipping: naira(2_200), estimatedTotal: naira(34_398) });
  });

  it("ignores client-sent prices and adds quantities for the same variant", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ price: 5_000, stock: 10 });
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ variantId: store.variantId, quantity: 1, unitPrice: 1, price: 1 }).expect(201);
    await app.addToCart(buyer, store.variantId, 2);
    const cart = (await app.client.get("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<CartBody>();
    expect(cart.stores[0]?.items[0]).toMatchObject({ quantity: 3, lineTotal: naira(15_000) });
  });

  it("enforces stock and quantity limits", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ stock: 2 });
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ variantId: store.variantId, quantity: 3 }).expect(422);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ variantId: store.variantId, quantity: 0 }).expect(400);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ variantId: store.variantId, quantity: 100 }).expect(400);
    await app.addToCart(buyer, store.variantId, 2);
    await app.client.patch(`/api/v1/cart/items/${store.variantId}`).auth(buyer.accessToken).send({ quantity: 5 }).expect(422);
    await app.client.patch(`/api/v1/cart/items/${store.variantId}`).auth(buyer.accessToken).send({ quantity: 1 }).expect(200);
  });

  it("removes items, clears the cart and keeps carts private", async () => {
    const buyer = await app.registerBuyer();
    const other = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    await app.addToCart(buyer, store.variantId, 1);
    await app.client.delete(`/api/v1/cart/items/${store.variantId}`).auth(other.accessToken).expect(404);
    const otherCart = (await app.client.get("/api/v1/cart").auth(other.accessToken).expect(200)).json<CartBody>();
    expect(otherCart.stores).toHaveLength(0);
    await app.client.delete(`/api/v1/cart/items/${store.variantId}`).auth(buyer.accessToken).expect(200);
    await app.addToCart(buyer, store.variantId, 1);
    const cleared = (await app.client.delete("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<CartBody>();
    expect(cleared.summary.estimatedTotal).toEqual(naira(0));
    await app.client.get("/api/v1/cart").expect(401);
  });
});
