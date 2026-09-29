import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, naira, type MoneyShape } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

async function paidOrder(price = 20_000) {
  const buyer = await app.registerBuyer();
  const store = await app.createStoreWithProduct({ price });
  const placed = await app.buyAndPay(buyer, store);
  return { buyer, store, orderId: placed.orders[0]?.id ?? "" };
}

async function readWallet(accessToken: string, storeId: string) {
  return (await app.client.get(`/api/v1/stores/${storeId}/wallet`).auth(accessToken).expect(200)).json<{ availableBalance: MoneyShape; heldInEscrow: MoneyShape }>();
}

function confirmReceipt(accessToken: string, orderId: string, key = createIdempotencyKey()) {
  return app.client.post(`/api/v1/orders/${orderId}/confirm-receipt`).auth(accessToken).set("idempotency-key", key);
}

describe("escrow release", () => {
  it("releases once on buyer confirmation, paying the seller minus commission", async () => {
    const { buyer, store, orderId } = await paidOrder(20_000);
    expect(await readWallet(store.seller.accessToken, store.storeId)).toMatchObject({ availableBalance: naira(0), heldInEscrow: naira(20_000) });
    const key = createIdempotencyKey();
    await confirmReceipt(buyer.accessToken, orderId, key).expect(200).expectJson({ escrow: { status: "released" } });
    await confirmReceipt(buyer.accessToken, orderId, key).expect(200);
    await confirmReceipt(buyer.accessToken, orderId).expect(409);
    expect(await readWallet(store.seller.accessToken, store.storeId)).toMatchObject({ availableBalance: naira(19_000), heldInEscrow: naira(0) });
    await app.client.get(`/api/v1/orders/${orderId}`).auth(buyer.accessToken).expect(200).expectJson({ status: "completed" });
  });

  it("does not let another buyer confirm or view the escrow", async () => {
    const { orderId } = await paidOrder();
    const stranger = await app.registerBuyer();
    await confirmReceipt(stranger.accessToken, orderId).expect(404);
    await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(stranger.accessToken).expect(404);
  });

  it("auto-releases after the inspection period that starts at delivery", async () => {
    const { store, orderId } = await paidOrder(10_000);
    const base = `/api/v1/stores/${store.storeId}/orders/${orderId}`;
    await app.client.post(`${base}/ship`).auth(store.seller.accessToken).send({}).expect(200);
    await app.client.post(`${base}/deliver`).auth(store.seller.accessToken).expect(200);
    const job = app.dependencies.scheduledJobs.find((entry) => entry.id === "escrow-auto-release");
    await job?.run();
    await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(store.seller.accessToken).expect(200).expectJson({ status: "held" });
    app.clock.advanceBySeconds(3 * 86_400 + 1);
    await job?.run();
    await job?.run();
    const login = await app.client.post("/api/v1/auth/login").send({ identifier: store.seller.email, password: store.seller.password }).expect(200);
    const accessToken = login.json<{ tokens: { accessToken: string } }>().tokens.accessToken;
    await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(accessToken).expect(200).expectJson({ status: "released" });
    expect((await readWallet(accessToken, store.storeId)).availableBalance).toEqual(naira(9_500));
  });
});

describe("disputes", () => {
  it("freezes the escrow and lets an admin refund the buyer", async () => {
    const { buyer, store, orderId } = await paidOrder(12_000);
    const admin = await app.registerAdmin();
    const dispute = await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).send({ reason: "not_received" }).expect(201);
    const disputeId = dispute.json<{ id: string }>().id;
    await confirmReceipt(buyer.accessToken, orderId).expect(409);
    await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).send({ reason: "other" }).expect(409);
    await app.client.get("/api/v1/admin/disputes").auth(store.seller.accessToken).expect(403);
    const listed = (await app.client.get("/api/v1/admin/disputes").query({ status: "open" }).auth(admin.accessToken).expect(200)).json<{ items: { id: string }[] }>();
    expect(listed.items.map((item) => item.id)).toContain(disputeId);

    const resolve = { outcome: "refund", note: "Parcel lost by courier" };
    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).send(resolve).expect(400);
    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).send(resolve).expect(200).expectJson({ status: "resolved_refund" });
    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).send({ outcome: "release", note: "again" }).expect(409);
    expect(app.paystack.refunds.at(-1)?.amount).toBe(12_000);
    await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(buyer.accessToken).expect(200).expectJson({ status: "refunded" });
    await app.client.get(`/api/v1/orders/${orderId}`).auth(buyer.accessToken).expect(200).expectJson({ status: "refunded" });
    expect(await readWallet(store.seller.accessToken, store.storeId)).toMatchObject({ availableBalance: naira(0), heldInEscrow: naira(0) });
  });

  it("lets an admin release a disputed escrow to the seller", async () => {
    const { buyer, store, orderId } = await paidOrder(8_000);
    const admin = await app.registerAdmin();
    const disputeId = (await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).send({ reason: "damaged" }).expect(201)).json<{ id: string }>().id;
    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).send({ outcome: "release", note: "Seller showed proof of delivery" }).expect(200);
    expect((await readWallet(store.seller.accessToken, store.storeId)).availableBalance).toEqual(naira(7_600));
  });

  it("does not allow a dispute after the escrow was released", async () => {
    const { buyer, orderId } = await paidOrder();
    await confirmReceipt(buyer.accessToken, orderId).expect(200);
    await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).send({ reason: "other" }).expect(409);
  });
});
