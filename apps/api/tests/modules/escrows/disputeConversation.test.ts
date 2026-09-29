import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

type Timeline = { status: string; autoReleaseAt: string | null; timeline: { type: string; details: Record<string, string | null> }[] };

async function paidOrder() {
  const buyer = await app.registerBuyer();
  const store = await app.createStoreWithProduct({ price: 15_000 });
  const placed = await app.buyAndPay(buyer, store);
  return { buyer, store, orderId: placed.orders[0]?.id ?? "" };
}

describe("escrow timeline", () => {
  it("shows held, shipped (courier and tracking), delivered, auto-release time and dispute events", async () => {
    const { buyer, store, orderId } = await paidOrder();
    await app.client.post(`/api/v1/seller/orders/${orderId}/ship`).auth(store.seller.accessToken).send({ courier: "GIG Logistics", trackingNumber: "GIG-123" }).expect(200).expectJson({ courier: "GIG Logistics", trackingNumber: "GIG-123" });
    await app.client.post(`/api/v1/seller/orders/${orderId}/deliver`).auth(store.seller.accessToken).expect(200);
    const delivered = (await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(buyer.accessToken).expect(200)).json<Timeline>();
    expect(delivered.timeline.map((event) => event.type)).toEqual(["held", "shipped", "delivered"]);
    expect(delivered.timeline[1]?.details).toEqual({ courier: "GIG Logistics", trackingNumber: "GIG-123" });
    expect(delivered.autoReleaseAt).toBe(new Date(app.clock.now().getTime() + 3 * 86_400_000).toISOString());

    const evidence = [randomUUID(), randomUUID()];
    const dispute = await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ reason: "damaged", evidenceMediaIds: evidence }).expect(201);
    expect(dispute.json<{ evidenceMediaIds: string[] }>().evidenceMediaIds).toEqual(evidence);
    const admin = await app.registerAdmin();
    const disputeId = dispute.json<{ id: string }>().id;
    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).send({ outcome: "release", note: "Seller proved delivery" }).expect(200);
    const resolved = (await app.client.get(`/api/v1/orders/${orderId}/escrow`).auth(store.seller.accessToken).expect(200)).json<Timeline>();
    expect(resolved.timeline.map((event) => event.type)).toEqual(["held", "shipped", "delivered", "dispute_opened", "dispute_resolved", "released"]);
    expect(resolved.autoReleaseAt).toBeNull();
  });
});

describe("dispute conversation", () => {
  it("lets the buyer, store members and admins read and post messages, and nobody else", async () => {
    const { buyer, store, orderId } = await paidOrder();
    const admin = await app.registerAdmin();
    const stranger = await app.registerBuyer();
    const disputeId = (await app.client.post(`/api/v1/orders/${orderId}/disputes`).auth(buyer.accessToken).set("idempotency-key", createIdempotencyKey()).send({ reason: "not_received" }).expect(201)).json<{ id: string }>().id;
    await app.client.get(`/api/v1/disputes/${disputeId}`).auth(buyer.accessToken).expect(200).expectJson({ id: disputeId, viewerRole: "buyer", storeId: store.storeId });
    await app.client.get(`/api/v1/disputes/${disputeId}`).auth(store.seller.accessToken).expect(200).expectJson({ viewerRole: "seller" });
    await app.client.get(`/api/v1/disputes/${disputeId}`).auth(admin.accessToken).expect(200).expectJson({ viewerRole: "admin" });
    await app.client.get(`/api/v1/disputes/${disputeId}`).auth(stranger.accessToken).expect(404);
    await app.client.get(`/api/v1/disputes/${disputeId}/messages`).auth(stranger.accessToken).expect(404);
    await app.client.post(`/api/v1/disputes/${disputeId}/messages`).auth(stranger.accessToken).send({ text: "hi" }).expect(404);

    const attachment = randomUUID();
    await app.client.post(`/api/v1/disputes/${disputeId}/messages`).auth(buyer.accessToken).send({ text: "Still waiting", attachmentMediaIds: [attachment] }).expect(201).expectJson({ authorRole: "buyer", attachmentMediaIds: [attachment] });
    await app.client.post(`/api/v1/disputes/${disputeId}/messages`).auth(store.seller.accessToken).send({ text: "Courier delayed" }).expect(201).expectJson({ authorRole: "seller" });
    await app.client.post(`/api/v1/disputes/${disputeId}/messages`).auth(buyer.accessToken).send({ text: "" }).expect(400);
    const messages = (await app.client.get(`/api/v1/disputes/${disputeId}/messages`).auth(admin.accessToken).expect(200)).json<{ data: { text: string }[] }>();
    expect(messages.data.map((message) => message.text)).toEqual(["Still waiting", "Courier delayed"]);

    await app.client.post(`/api/v1/admin/disputes/${disputeId}/resolve`).auth(admin.accessToken).set("idempotency-key", createIdempotencyKey()).send({ outcome: "refund", note: "Never shipped" }).expect(200);
    await app.client.post(`/api/v1/disputes/${disputeId}/messages`).auth(buyer.accessToken).send({ text: "Thanks" }).expect(409);
  });
});
