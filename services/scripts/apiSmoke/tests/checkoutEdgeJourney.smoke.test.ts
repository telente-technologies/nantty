import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { addToCart, adjustStock, changeVariantPrice, createBuyerWithAddress, createStoreWithProduct, psql, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider, readProviderState } from "../src/fakeFlutterwave.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";
import { revokeSellerBusinessVerification, verifySellerBusiness } from "../src/sellerVerification.util.js";

const shippingMinor = 150_000;

async function placeOrder(buyer: UserActor, addressId: string): Promise<{ checkoutId: string; orderId: string; totalMinor: number }> {
  const placed = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId } });
  expect([200, 201], describeResponse(placed)).toContain(placed.status);
  return { checkoutId: placed.body.checkoutId, orderId: (placed.body.orders ?? placed.body.orderGroups)[0].id, totalMinor: placed.body.total?.amountMinor ?? 0 };
}

async function initialize(buyer: UserActor, checkoutId: string, idempotencyKey?: string) {
  return callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId }, ...(idempotencyKey === undefined ? {} : { headers: { "idempotency-key": idempotencyKey } }) });
}

function escrowOf(orderId: string): { status: string; amountMinor: number } | undefined {
  const row = psql(`select status, amount_minor from escrow.escrows where order_id = '${orderId}'`)[0];
  return row === undefined ? undefined : { status: row[0] ?? "", amountMinor: Number(row[1]) };
}

async function refundCount(): Promise<number> {
  return ((await readProviderState()).refunds ?? []).length;
}

describe("buying when real life gets in the way: stock, prices, double taps, late payments and late cancels", () => {
  let store: SmokeStore;
  let buyer: UserActor;
  let addressId = "";

  beforeAll(async () => {
    store = await createStoreWithProduct("edgeshop", 1_000_000, 40);
    ({ buyer, addressId } = await createBuyerWithAddress());
  });

  it("tells the second buyer the last unit is gone when someone else checked out first", async () => {
    const scarce = await createStoreWithProduct("edgescarce", 500_000, 1);
    const rival = await createBuyerWithAddress();
    await addToCart(buyer, scarce, 1);
    await addToCart(rival.buyer, scarce, 1);
    await placeOrder(rival.buyer, rival.addressId);
    const late = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId } });
    expectClearError(late, 409, "INSUFFICIENT_STOCK");
    expect(psql(`select count(*) from orders.order_groups where store_id = '${scarce.storeId}' and buyer_account_id = '${buyer.accountId}'`)[0]?.[0], "no half-made order").toBe("0");
    const cart = await callApi("GET", "/api/v1/cart", { token: buyer.accessToken });
    expect(JSON.stringify(cart.body), describeResponse(cart)).toMatch(/"available":false/);
    const cleared = await callApi("DELETE", "/api/v1/cart", { token: buyer.accessToken });
    expect([200, 204], describeResponse(cleared)).toContain(cleared.status);
  });

  it("refuses checkout when the seller removed the stock after it went into the cart", async () => {
    await addToCart(buyer, store, 2);
    await adjustStock(store, -40);
    const refused = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId } });
    expectClearError(refused, 409, "INSUFFICIENT_STOCK");
    await adjustStock(store, 40);
  });

  it("charges the new price when it changed before checkout and keeps the agreed price when it changed after", async () => {
    await changeVariantPrice(store, 1_200_000);
    const cart = await callApi("GET", "/api/v1/cart", { token: buyer.accessToken });
    expect(JSON.stringify(cart.body), "the cart shows the new price").toContain("1200000");
    const placed = await placeOrder(buyer, addressId);
    expect(placed.totalMinor, "checkout uses the current price").toBe(2 * 1_200_000 + shippingMinor);
    await changeVariantPrice(store, 900_000);
    const initialized = await initialize(buyer, placed.checkoutId);
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    expect(initialized.body.payment.amount.amountMinor, "the price agreed at checkout is what gets charged").toBe(placed.totalMinor);
    await payCheckoutThroughProvider(initialized.body.reference);
    const held = await waitFor(async () => (escrowOf(placed.orderId)?.status === "held" ? escrowOf(placed.orderId) : undefined), 20_000, 500);
    expect(held?.amountMinor).toBe(placed.totalMinor);
    await changeVariantPrice(store, 1_000_000);
  });

  it("charges once when Pay is double-tapped, refunds the extra charge, and refuses to pay a paid order again", async () => {
    await addToCart(buyer, store, 1);
    const placed = await placeOrder(buyer, addressId);
    const sameKey = `smoke-double-${placed.checkoutId}`;
    const [first, replay] = [await initialize(buyer, placed.checkoutId, sameKey), await initialize(buyer, placed.checkoutId, sameKey)];
    expect(first.status, describeResponse(first)).toBe(201);
    expect(replay.body.reference, "the same tap replays the same payment").toBe(first.body.reference);
    const [tapA, tapB] = await Promise.all([initialize(buyer, placed.checkoutId), initialize(buyer, placed.checkoutId)]);
    expect([tapA.status, tapB.status], `${describeResponse(tapA)} / ${describeResponse(tapB)}`).toEqual([201, 201]);
    const refundsBefore = await refundCount();
    await payCheckoutThroughProvider(tapA.body.reference);
    await payCheckoutThroughProvider(tapB.body.reference);
    const held = await waitFor(async () => (escrowOf(placed.orderId)?.status === "held" ? escrowOf(placed.orderId) : undefined), 20_000, 500);
    expect(held?.amountMinor, "escrow holds the order total once").toBe(placed.totalMinor);
    const succeeded = (await waitFor(async () => {
      const rows = psql(`select failure_reason, reference from payments.payment_intents where subject_id = '${placed.checkoutId}' and status = 'succeeded' order by paid_at`);
      return rows.length >= 2 ? rows : undefined;
    }, 20_000, 500)) ?? [];
    expect(succeeded.length, "both provider charges are recorded").toBe(2);
    expect(succeeded.map((row) => row[0]), "the second charge is marked as a duplicate").toContain("duplicatePaymentRefunded");
    expect(await waitFor(async () => ((await refundCount()) > refundsBefore ? true : undefined), 20_000, 500), "the duplicate charge goes back to the card").toBe(true);
    const again = await initialize(buyer, placed.checkoutId);
    expectClearError(again, 409, "ALREADY_PAID");
    expectLedgerBalancedSince(15);
  });

  it("refunds a payment that lands after the buyer cancelled the unpaid order", async () => {
    await addToCart(buyer, store, 1);
    const placed = await placeOrder(buyer, addressId);
    const initialized = await initialize(buyer, placed.checkoutId);
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    const cancelled = await callApi("POST", `/api/v1/orders/${placed.orderId}/cancel`, { token: buyer.accessToken, body: { reason: "Took too long, gave up" } });
    expect([200, 201], describeResponse(cancelled)).toContain(cancelled.status);
    const payAgain = await initialize(buyer, placed.checkoutId);
    expectClearError(payAgain, [409, 410, 422], ["ORDER_CANCELLED", "CHECKOUT_CLOSED", "NOTHING_TO_PAY"]);
    const refundsBefore = await refundCount();
    await payCheckoutThroughProvider(initialized.body.reference);
    const refunded = await waitFor(async () => (escrowOf(placed.orderId)?.status === "refunded" ? escrowOf(placed.orderId) : undefined), 30_000, 500);
    expect(refunded, `late payment must be refunded: ${JSON.stringify(escrowOf(placed.orderId))}`).toBeDefined();
    const providerRefunds = await waitFor(async () => {
      const count = (await refundCount()) - refundsBefore;
      return count >= 1 ? count : undefined;
    }, 30_000, 500);
    expect(providerRefunds, "exactly one provider refund, sent through the outbox").toBe(1);
    const order = await callApi("GET", `/api/v1/orders/${placed.orderId}`, { token: buyer.accessToken });
    expect(order.body.status, describeResponse(order)).toBe("cancelled");
    expectLedgerBalancedSince(15);
  });

  it("refuses to cancel once the parcel has shipped and leaves the money in escrow", async () => {
    await addToCart(buyer, store, 1);
    const placed = await placeOrder(buyer, addressId);
    const initialized = await initialize(buyer, placed.checkoutId);
    await payCheckoutThroughProvider(initialized.body.reference);
    expect(await waitFor(async () => (escrowOf(placed.orderId)?.status === "held" ? true : undefined), 20_000, 500)).toBe(true);
    const headers = { "x-store-id": store.storeId };
    const accepted = await waitFor(async () => {
      const response = await callApi("POST", `/api/v1/seller/orders/${placed.orderId}/accept`, { token: store.seller.accessToken, headers, body: {} });
      return response.status === 409 ? undefined : response;
    }, 20_000, 1000);
    expect([200, 201, 204], describeResponse(accepted!)).toContain(accepted?.status);
    const shipped = await callApi("POST", `/api/v1/seller/orders/${placed.orderId}/fulfilment`, { token: store.seller.accessToken, headers, body: { courier: "GIG Logistics", trackingNumber: `TRK${Date.now()}`, fromLocationId: store.locationId } });
    expect([200, 201], describeResponse(shipped)).toContain(shipped.status);
    const cancel = await callApi("POST", `/api/v1/orders/${placed.orderId}/cancel`, { token: buyer.accessToken, body: { reason: "Changed my mind" } });
    expectClearError(cancel, 409, "ORDER_NOT_CANCELLABLE");
    expect(escrowOf(placed.orderId)?.status, "money stays held until delivery or a dispute").toBe("held");
  });

  it("caps an unverified seller at the ₦200,000 sales limit, lifts it on business verification and restores it on revocation", { timeout: 120_000 }, async () => {
    const staff = await createSuperadmin();
    const capSetting = await callApi("GET", "/api/v1/admin/config/seller.unverifiedSalesCap", { token: staff.accessToken });
    expect(capSetting.status, describeResponse(capSetting)).toBe(200);
    const capMinor = Number(capSetting.body.value?.capsMinor?.NGN ?? 20_000_000);
    const pricey = await createStoreWithProduct("edgecap", capMinor, 5);
    const capBuyer = await createBuyerWithAddress();
    await addToCart(capBuyer.buyer, pricey, 1);
    const capped = await callApi("POST", "/api/v1/orders/checkout", { token: capBuyer.buyer.accessToken, body: { addressId: capBuyer.addressId } });
    expectClearError(capped, 409, "SELLER_SALES_CAP_REACHED");
    await verifySellerBusiness(staff, pricey.seller);
    const allowed = await placeOrder(capBuyer.buyer, capBuyer.addressId);
    expect(allowed.totalMinor, "a verified seller sells past the cap").toBeGreaterThan(capMinor);
    await revokeSellerBusinessVerification(staff, pricey.seller, "The CAC registration was struck off");
    await addToCart(capBuyer.buyer, pricey, 1);
    const cappedAgain = await callApi("POST", "/api/v1/orders/checkout", { token: capBuyer.buyer.accessToken, body: { addressId: capBuyer.addressId } });
    expectClearError(cappedAgain, 409, "SELLER_SALES_CAP_REACHED");
  });
});
