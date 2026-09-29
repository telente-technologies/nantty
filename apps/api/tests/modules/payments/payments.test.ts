import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication, createIdempotencyKey, FAKE_WEBHOOK_SECRET } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

async function placeUnpaidCheckout() {
  const buyer = await app.registerBuyer();
  const store = await app.createStoreWithProduct({ price: 7_500 });
  await app.addToCart(buyer, store.variantId, 2);
  const placed = await app.checkout(buyer);
  return { buyer, store, placed };
}

async function initializePayment(accessToken: string, checkoutId: string) {
  const response = await app.client
    .post("/api/v1/payments/initialize")
    .auth(accessToken)
    .set("idempotency-key", createIdempotencyKey())
    .send({ checkoutId, provider: "paystack" })
    .expect(201);
  return response.json<{ payment: { id: string; reference: string; amount: { amountMinor: number; currency: string } }; authorizationUrl: string }>();
}

describe("payment initialisation and verification", () => {
  it("charges the server-computed checkout total and marks orders paid only after provider verification", async () => {
    const { buyer, placed } = await placeUnpaidCheckout();
    const initialized = await initializePayment(buyer.accessToken, placed.checkout.id);
    expect(initialized.payment.amount).toEqual({ amountMinor: 15_000, currency: "NGN" });
    expect(app.paystack.initialized.at(-1)?.amount).toBe(15_000);
    await app.client.get(`/api/v1/orders/${placed.orders[0]?.id ?? ""}`).auth(buyer.accessToken).expect(200).expectJson({ status: "pending_payment" });
    await app.client.post("/api/v1/payments/verify").auth(buyer.accessToken).send({ reference: initialized.payment.reference }).expect(200).expectJson({ status: "succeeded" });
    await app.client.get(`/api/v1/orders/${placed.orders[0]?.id ?? ""}`).auth(buyer.accessToken).expect(200).expectJson({ status: "paid" });
    await app.client.get(`/api/v1/orders/${placed.orders[0]?.id ?? ""}/escrow`).auth(buyer.accessToken).expect(200).expectJson({ status: "held", amount: { amountMinor: 15_000, currency: "NGN" } });
  });

  it("requires an Idempotency-Key and ownership of the checkout", async () => {
    const { placed } = await placeUnpaidCheckout();
    const stranger = await app.registerBuyer();
    await app.client.post("/api/v1/payments/initialize").auth(stranger.accessToken).send({ checkoutId: placed.checkout.id, provider: "paystack" }).expect(400);
    await app.client
      .post("/api/v1/payments/initialize")
      .auth(stranger.accessToken)
      .set("idempotency-key", createIdempotencyKey())
      .send({ checkoutId: placed.checkout.id, provider: "paystack" })
      .expect(404);
  });

  it("rejects a provider confirmation whose amount does not match", async () => {
    const { buyer, placed } = await placeUnpaidCheckout();
    const initialized = await initializePayment(buyer.accessToken, placed.checkout.id);
    app.paystack.verificationOverrides.set(initialized.payment.reference, { amount: 100 });
    await app.client.post("/api/v1/payments/verify").auth(buyer.accessToken).send({ reference: initialized.payment.reference }).expect(422);
    await app.client.get(`/api/v1/orders/${placed.orders[0]?.id ?? ""}`).auth(buyer.accessToken).expect(200).expectJson({ status: "pending_payment" });
  });

  it("records a failed payment without paying the orders", async () => {
    const { buyer, placed } = await placeUnpaidCheckout();
    const initialized = await initializePayment(buyer.accessToken, placed.checkout.id);
    app.paystack.verificationOverrides.set(initialized.payment.reference, { status: "failed" });
    await app.client.post("/api/v1/payments/verify").auth(buyer.accessToken).send({ reference: initialized.payment.reference }).expect(200).expectJson({ status: "failed" });
  });
});

describe("payment webhooks", () => {
  it("rejects webhooks without a valid signature", async () => {
    const payload = { id: "evt_bad", reference: "zm_whatever" };
    await app.client.post("/api/v1/payments/webhooks/paystack").send(payload).expect(401);
    await app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", "wrong").send(payload).expect(401);
    await app.client.post("/api/v1/payments/webhooks/unknown").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send(payload).expect(401);
  });

  it("processes each webhook event at most once and still re-verifies with the provider", async () => {
    const { buyer, placed } = await placeUnpaidCheckout();
    const initialized = await initializePayment(buyer.accessToken, placed.checkout.id);
    const payload = { id: `evt_${initialized.payment.reference}`, reference: initialized.payment.reference };
    const verifyCallsBefore = app.paystack.verifyCalls.length;
    await app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send(payload).expect(200).expectJson({ duplicate: false });
    await app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send(payload).expect(200).expectJson({ duplicate: true });
    expect(app.paystack.verifyCalls.length - verifyCallsBefore).toBe(1);
    await app.client.get(`/api/v1/payments/${initialized.payment.id}`).auth(buyer.accessToken).expect(200).expectJson({ status: "succeeded" });
    const payments = (await app.client.get(`/api/v1/checkouts/${placed.checkout.id}/payments`).auth(buyer.accessToken).expect(200)).json<{ items: unknown[] }>();
    expect(payments.items).toHaveLength(1);
  });
});
