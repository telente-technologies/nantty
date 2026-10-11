import { beforeAll, describe, expect, it } from "vitest";

import type { UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { addToCart, checkout, createBuyerWithAddress, createStoreWithProduct, onboardPayoutAccount, psql, shipAndDeliver, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider, settleCardPaymentsFor } from "../src/fakeFlutterwave.util.js";

const itemPriceMinor = 1_000_000;
const shippingMinor = 150_000;
const groupTotal = itemPriceMinor + shippingMinor;
const web = { "x-client-platform": "web", "x-client-region": "NG" };

function escrowRow(orderId: string): string[] | undefined {
  return psql(`select status, commission_bps, commission_minor from escrow.escrows where order_id = '${orderId}'`)[0];
}

describe("Business plan: a seller on Business pays the 1% escrow fee end to end", () => {
  let store: SmokeStore;
  let buyer: UserActor;
  let addressId = "";
  let orderId = "";

  beforeAll(async () => {
    store = await createStoreWithProduct("sellerbiz", itemPriceMinor);
    ({ buyer, addressId } = await createBuyerWithAddress());
  });

  it("activates the Business plan from the paid checkout, with no provider-managed plan subscription", async () => {
    const started = await callApi("POST", "/api/v1/seller/subscription/checkout", { token: store.seller.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_business_monthly" } });
    expect(started.status, describeResponse(started)).toBe(201);
    await payCheckoutThroughProvider(started.body.reference);
    const active = await waitFor(async () => {
      const row = psql(`select plan_code, status from subscriptions.subscriptions where id = '${started.body.subscriptionId}'`)[0];
      return row?.[1] === "active" ? row : undefined;
    }, 30_000, 1000);
    expect(active, `subscription never became active: ${JSON.stringify(psql(`select plan_code, status, last_error from subscriptions.subscriptions where id = '${started.body.subscriptionId}'`))}`).toEqual(["seller_business", "active"]);
  });

  it("charges 100 bps on the escrow hold instead of 150", async () => {
    await addToCart(buyer, store, 1);
    const placed = await checkout(buyer, addressId);
    orderId = placed.orderIds[0]!;
    const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    await payCheckoutThroughProvider(initialized.body.reference, 20_000);
    const held = await waitFor(async () => (escrowRow(orderId)?.[0] === "held" ? escrowRow(orderId) : undefined), 20_000, 500);
    expect(held, "escrow was not held").toBeDefined();
    expect(Number(held![1]), "Business escrow fee bps").toBe(100);
    expect(Number(held![2]), "1% of the seller-group total").toBe(Math.round(groupTotal * 0.01));
  });

  it("earns exactly 1% as escrow-fee revenue on release", { timeout: 240_000 }, async () => {
    await onboardPayoutAccount(store.seller);
    await shipAndDeliver(store, orderId);
    await settleCardPaymentsFor([orderId]);
    const confirmed = await callApi("POST", `/api/v1/orders/${orderId}/confirm-receipt`, { token: buyer.accessToken, body: {} });
    expect([200, 201], describeResponse(confirmed)).toContain(confirmed.status);
    const released = await waitFor(async () => (escrowRow(orderId)?.[0] === "released" ? escrowRow(orderId) : undefined), 90_000, 1000);
    expect(released, "escrow was not released").toBeDefined();
    const revenueRows = () => psql(`select l.amount_minor from escrow.escrows x join ledger.journal_entries e on (e.reference like '%' || x.id::text || '%' or e.metadata->>'escrowId' = x.id::text) join ledger.journal_lines l on l.entry_id = e.id join ledger.ledger_accounts a on a.id = l.account_id where x.order_id = '${orderId}' and a.code like 'revenue:escrowFees%' and l.direction = 'credit'`);
    const revenue = (await waitFor(async () => (revenueRows().length > 0 ? revenueRows() : undefined), 90_000, 2000)) ?? [];
    expect(revenue.map((row) => Number(row[0])), "escrow-fee revenue booked at release").toEqual([Math.round(groupTotal * 0.01)]);
  });
});
