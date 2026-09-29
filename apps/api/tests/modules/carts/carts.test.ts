import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, naira, type MoneyShape } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

interface CartItemBody {
  readonly id: string;
  readonly product: { readonly id: string; readonly name: string; readonly price: MoneyShape };
  readonly quantity: number;
  readonly variant: { readonly id: string; readonly size: string | null; readonly color: string | null };
  readonly lineTotal: MoneyShape;
}

interface CartBody {
  readonly items: readonly CartItemBody[];
  readonly itemsTotal: MoneyShape;
  readonly shopDiscount: MoneyShape;
  readonly shipping: MoneyShape;
  readonly total: MoneyShape;
  readonly displayCurrency: string;
  readonly stores: { store: { id: string }; itemsTotal: MoneyShape; shopDiscount: MoneyShape; shipping: MoneyShape; total: MoneyShape }[];
}

async function readCart(accessToken: string): Promise<CartBody> {
  return (await app.client.get("/api/v1/cart").auth(accessToken).expect(200)).json<CartBody>();
}

describe("cart totals", () => {
  it("computes items, shop discount, shipping and total per store and overall", async () => {
    const buyer = await app.registerBuyer();
    const first = await app.createStoreWithProduct({ price: 10_000, stock: 12, shippingFee: 1_500, discountBps: 1_000 });
    const second = await app.createStoreWithProduct({ price: 2_599, stock: 5, shippingFee: 700 });
    await app.addToCart(buyer, first.variantId, 3);
    await app.addToCart(buyer, second.variantId, 2);

    const cart = await readCart(buyer.accessToken);
    expect(cart.stores.find((group) => group.store.id === first.storeId)).toMatchObject({ itemsTotal: naira(30_000), shopDiscount: naira(3_000), shipping: naira(1_500), total: naira(28_500) });
    expect(cart.stores.find((group) => group.store.id === second.storeId)).toMatchObject({ itemsTotal: naira(5_198), shopDiscount: naira(0), shipping: naira(700), total: naira(5_898) });
    expect(cart.displayCurrency).toBe("NGN");
    expect({ itemsTotal: cart.itemsTotal, shopDiscount: cart.shopDiscount, shipping: cart.shipping, total: cart.total }).toEqual({
      itemsTotal: naira(35_198),
      shopDiscount: naira(3_000),
      shipping: naira(2_200),
      total: naira(34_398),
    });
    expect(cart.items.find((item) => item.product.id === first.productId)).toMatchObject({ quantity: 3, variant: { id: first.variantId }, product: { name: "Ankara Dress", price: naira(10_000) } });
  });

  it("ignores client-sent prices and adds quantities for the same product", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ price: 5_000, stock: 10 });
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1, unitPrice: 1, price: 1 }).expect(201);
    const cart = (await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 2 }).expect(201)).json<CartBody>();
    expect(cart.items[0]).toMatchObject({ quantity: 3, lineTotal: naira(15_000) });
  });

  it("enforces stock and quantity limits and addresses items by cart item id", async () => {
    const buyer = await app.registerBuyer();
    const store = await app.createStoreWithProduct({ stock: 2 });
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 3 }).expect(422);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 0 }).expect(400);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 100 }).expect(400);
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1, size: "XXL" }).expect(422);
    await app.addToCart(buyer, store.variantId, 2);
    const itemId = (await readCart(buyer.accessToken)).items[0]?.id ?? "";
    await app.client.patch(`/api/v1/cart/items/${itemId}`).auth(buyer.accessToken).send({ quantity: 5 }).expect(422);
    const updated = (await app.client.patch(`/api/v1/cart/items/${itemId}`).auth(buyer.accessToken).send({ quantity: 1 }).expect(200)).json<CartBody>();
    expect(updated.items[0]?.quantity).toBe(1);
  });

  it("removes items, clears the cart and keeps carts private", async () => {
    const buyer = await app.registerBuyer();
    const other = await app.registerBuyer();
    const store = await app.createStoreWithProduct();
    await app.addToCart(buyer, store.variantId, 1);
    const itemId = (await readCart(buyer.accessToken)).items[0]?.id ?? "";
    await app.client.delete(`/api/v1/cart/items/${itemId}`).auth(other.accessToken).expect(404);
    expect((await readCart(other.accessToken)).items).toHaveLength(0);
    const afterRemoval = (await app.client.delete(`/api/v1/cart/items/${itemId}`).auth(buyer.accessToken).expect(200)).json<CartBody>();
    expect(afterRemoval.items).toHaveLength(0);
    await app.addToCart(buyer, store.variantId, 1);
    const cleared = (await app.client.delete("/api/v1/cart").auth(buyer.accessToken).expect(200)).json<CartBody>();
    expect(cleared.total).toEqual(naira(0));
    await app.client.get("/api/v1/cart").expect(401);
  });
});
