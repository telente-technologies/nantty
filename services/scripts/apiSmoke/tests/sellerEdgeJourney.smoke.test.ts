import { beforeAll, describe, expect, it } from "vitest";

import type { UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { addToCart, checkout, createBuyerWithAddress, createStoreWithProduct, psql, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughFakePaystack, readFakePaystackState } from "../src/fakePaystack.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";

function escrowOf(orderId: string): string[] | undefined {
  return psql(`select status, amount_minor, coalesce(refunded_minor, 0) from escrow.escrows where order_id = '${orderId}'`)[0];
}

describe("selling on the free plan, and refunds that ask for more than is left", () => {
  let store: SmokeStore;
  let buyer: UserActor;
  let addressId = "";
  let orderId = "";
  let totalMinor = 0;

  beforeAll(async () => {
    store = await createStoreWithProduct("edgefree", 800_000);
    ({ buyer, addressId } = await createBuyerWithAddress());
  });

  it("runs the everyday dashboard on the free plan", async () => {
    const headers = { "x-store-id": store.storeId };
    for (const path of ["/api/v1/seller/products", "/api/v1/seller/orders", "/api/v1/seller/inventory/levels", "/api/v1/seller/inventory/summary", "/api/v1/seller/customers", "/api/v1/seller/shipping/profile", "/api/v1/seller/subscription/plans"]) {
      const response = await callApi("GET", path, { token: store.seller.accessToken, headers });
      expect(response.status, `${path}: ${describeResponse(response)}`).toBe(200);
    }
  });

  it("explains which plan unlocks the paid tools instead of failing", async () => {
    const headers = { "x-store-id": store.storeId };
    for (const [method, path] of [["GET", "/api/v1/seller/inventory/movements"], ["GET", "/api/v1/seller/inventory/reorder"], ["GET", "/api/v1/seller/marketing/flash-sales"], ["GET", "/api/v1/seller/products/export"]] as const) {
      const response = await callApi(method, path, { token: store.seller.accessToken, headers });
      expectClearError(response, 402, "PLAN_FEATURE_REQUIRED");
      expect(response.body.requiredPlan, path).toBe("pro");
      expect(response.body.message).toMatch(/Upgrade to the pro plan/);
    }
  });

  it("refuses a refund above what the buyer paid, then a second refund after a partial one", { timeout: 90_000 }, async () => {
    await addToCart(buyer, store, 1);
    const placed = await checkout(buyer, addressId);
    orderId = placed.orderIds[0]!;
    const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    totalMinor = initialized.body.payment.amount.amountMinor;
    await payCheckoutThroughFakePaystack(initialized.body.reference);
    expect(await waitFor(async () => (escrowOf(orderId)?.[0] === "held" ? true : undefined), 20_000, 500), "escrow held").toBe(true);
    expect(await waitFor(async () => (psql(`select payment_status from orders.order_groups where id = '${orderId}'`)[0]?.[0] === "paid" ? true : undefined), 20_000, 500), "the seller sees the order as paid").toBe(true);
    const headers = { "x-store-id": store.storeId };
    const tooMuch = await callApi("POST", `/api/v1/seller/orders/${orderId}/refunds`, { token: store.seller.accessToken, headers, body: { amountMinor: totalMinor + 1, reason: "Fat finger" } });
    expectClearError(tooMuch, [400, 422]);
    expect(JSON.stringify(tooMuch.body)).toMatch(/more than the buyer paid/);
    const zero = await callApi("POST", `/api/v1/seller/orders/${orderId}/refunds`, { token: store.seller.accessToken, headers, body: { amountMinor: 0, reason: "Nothing" } });
    expectClearError(zero, 422, "REFUND_AMOUNT_INVALID");
    const refundsBefore = ((await readFakePaystackState()).refunds ?? []).length;
    const partial = Math.floor(totalMinor / 2);
    const first = await callApi("POST", `/api/v1/seller/orders/${orderId}/refunds`, { token: store.seller.accessToken, headers, body: { amountMinor: partial, reason: "One item damaged" } });
    expect([200, 201], describeResponse(first)).toContain(first.status);
    const second = await callApi("POST", `/api/v1/seller/orders/${orderId}/refunds`, { token: store.seller.accessToken, headers, body: { amountMinor: totalMinor - partial + 1, reason: "And the rest" } });
    expectClearError(second, [400, 409, 422]);
    const settled = await waitFor(async () => (/refunded/i.test(escrowOf(orderId)?.[0] ?? "") ? escrowOf(orderId) : undefined), 30_000, 500);
    expect(settled, `escrow after partial refund: ${JSON.stringify(escrowOf(orderId))}`).toBeDefined();
    expect(((await readFakePaystackState()).refunds ?? []).length - refundsBefore, "one provider refund").toBe(1);
    const refunds = psql(`select coalesce(sum(amount_minor), 0) from payments.payment_refunds where payment_intent_id in (select id from payments.payment_intents where subject_id = '${placed.checkoutId}')`)[0]?.[0];
    expect(Number(refunds), "never refund more than was paid").toBeLessThanOrEqual(totalMinor);
    expectLedgerBalancedSince(15);
  });
});
