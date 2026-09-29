import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, naira, type MoneyShape } from "../orders/commerceSetup.fixture.js";
import { registerApprovedCreator } from "./creatorSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

async function readPersonalWallet(accessToken: string): Promise<MoneyShape[]> {
  return (await app.client.get("/api/v1/creators/dashboard?period=all").auth(accessToken).expect(200)).json<{ walletBalances: MoneyShape[] }>().walletBalances;
}

describe("creator earnings with the ledger wallets", () => {
  it("pays an affiliate commission on escrow release, then lets the creator spend it on gifts until funds run out", async () => {
    const store = await app.createStoreWithProduct({ price: 100_000 });
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(store.seller.accessToken).send({ productId: store.productId, commissionBps: 1_500 }).expect(200);
    const creator = await registerApprovedCreator(app);
    await app.client.patch("/api/v1/users/me/preferences").auth(creator.accessToken).send({ countryCode: "NG" }).expect(200);
    const clip = (await app.client.post("/api/v1/posts").auth(creator.accessToken).send({ kind: "clip", media: [{ url: "https://cdn.example.com/a.mp4", type: "video" }], productIds: [store.productId] }).expect(201)).json<{ id: string }>();

    const buyer = await app.registerBuyer();
    await app.client.post("/api/v1/cart/items").auth(buyer.accessToken).send({ productId: store.productId, quantity: 1, attribution: { source: "clip", id: clip.id } }).expect(201);
    const placed = await app.checkout(buyer);
    await app.payCheckout(buyer, placed.payableOrderId);
    const orderId = placed.orders[0]?.id ?? "";
    await app.client.post(`/api/v1/orders/${orderId}/confirm-receipt`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200);

    expect(await readPersonalWallet(creator.accessToken)).toEqual([naira(15_000)]);
    const earnings = (await app.client.get("/api/v1/creators/earnings").auth(creator.accessToken).expect(200)).json<{ data: { kind: string; orderId: string; amount: MoneyShape }[] }>();
    expect(earnings.data).toEqual([expect.objectContaining({ kind: "affiliate", orderId, amount: naira(15_000), source: { type: "clip", id: clip.id } })]);

    const host = await registerApprovedCreator(app);
    const live = (await app.client.post("/api/v1/lives").auth(host.accessToken).send({ title: "Gifts please" }).expect(201)).json<{ id: string }>();
    const sendRose = (key = createIdempotencyKey()) =>
      app.client.post(`/api/v1/lives/${live.id}/gifts`).auth(creator.accessToken).set("idempotency-key", key).send({ giftId: "rose" });
    const key = createIdempotencyKey();
    await sendRose(key).expect(201);
    await sendRose(key).expect(201);
    expect(await readPersonalWallet(creator.accessToken)).toEqual([naira(5_000)]);
    expect(await readPersonalWallet(host.accessToken)).toEqual([naira(7_000)]);
    const refused = await sendRose();
    expect(refused.status).toBe(422);
    expect(refused.text).toContain("Insufficient");
    expect(await readPersonalWallet(creator.accessToken)).toEqual([naira(5_000)]);
  });

  it("pays no commission when the creator buys through their own clip", async () => {
    const store = await app.createStoreWithProduct({ price: 50_000 });
    await app.client.put("/api/v1/seller/affiliates/commissions").auth(store.seller.accessToken).send({ storeId: store.storeId, commissionBps: 1_000 }).expect(200);
    const creator = await registerApprovedCreator(app);
    const post = (await app.client.post("/api/v1/posts").auth(creator.accessToken).send({ text: "Mine", productIds: [store.productId] }).expect(201)).json<{ id: string }>();
    await app.client.post("/api/v1/users/me/addresses").auth(creator.accessToken).send({ fullName: "Ada Creator", phone: "08031234567", line1: "1 Road", city: "Ikeja", state: "Lagos" }).expect(201);
    await app.client.post("/api/v1/cart/items").auth(creator.accessToken).send({ productId: store.productId, quantity: 1, attribution: { source: "post", id: post.id } }).expect(201);
    const placed = await app.checkout(creator);
    await app.payCheckout(creator, placed.payableOrderId);
    await app.client.post(`/api/v1/orders/${placed.orders[0]?.id}/confirm-receipt`).auth(creator.accessToken).set("idempotency-key", createIdempotencyKey()).expect(200);
    expect(await readPersonalWallet(creator.accessToken)).toEqual([]);
    expect((await app.client.get("/api/v1/creators/earnings").auth(creator.accessToken).expect(200)).json<{ data: unknown[] }>().data).toEqual([]);
  });
});
