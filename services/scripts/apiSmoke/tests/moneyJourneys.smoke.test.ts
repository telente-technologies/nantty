import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, stepUpStaff, stepUpStaffForMoneyAction, stepUpUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { addToCart, checkout, createBuyerWithAddress, createStoreWithProduct, onboardPayoutAccount, psql, shipAndDeliver, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider, readProviderState, settleTransferThroughProvider, isOpenProviderTransfer } from "../src/fakeFlutterwave.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";
import { verifySellerBusiness } from "../src/sellerVerification.util.js";

const processingFeeMinor = 60_000;
const itemPriceMinor = 1_000_000;
const ngn = { "x-client-region": "NG" };

async function initializeAndPay(buyer: UserActor, checkoutId: string, feeMinor: number): Promise<{ reference: string; amountMinor: number }> {
  const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId } });
  expect(initialized.status, describeResponse(initialized)).toBe(201);
  await payCheckoutThroughProvider(initialized.body.reference, feeMinor);
  return { reference: initialized.body.reference, amountMinor: initialized.body.payment?.amount?.amountMinor ?? 0 };
}

async function waitForEscrowStatus(orderId: string, status: string, timeoutMs = 20_000): Promise<string[] | undefined> {
  return waitFor(async () => {
    const row = psql(`select status, release_trigger, commission_bps, commission_minor, seller_amount_minor, processing_fee_minor, amount_minor from escrow.escrows where order_id = '${orderId}'`)[0];
    return row?.[0] === status ? row : undefined;
  }, timeoutMs, 500);
}

describe("money journeys: multi-seller checkout, escrow timers, fees, payout, refund", () => {
  let staff: StaffActor;
  let storeA: SmokeStore;
  let storeB: SmokeStore;
  let buyer: UserActor;
  let addressId = "";
  let orderA = "";
  let orderB = "";
  let paidTotal = 0;

  beforeAll(async () => {
    staff = await createSuperadmin();
    storeA = await createStoreWithProduct("sellera", itemPriceMinor);
    storeB = await createStoreWithProduct("sellerb", itemPriceMinor);
    ({ buyer, addressId } = await createBuyerWithAddress());
  });

  it("checks out two sellers in one cart as one payment and holds both in escrow with the processing fee split", async () => {
    await addToCart(buyer, storeA, 1);
    await addToCart(buyer, storeB, 1);
    const placed = await checkout(buyer, addressId);
    expect(placed.orderIds.length, JSON.stringify(placed.body).slice(0, 400)).toBe(2);
    [orderA, orderB] = placed.orderIds as [string, string];
    const paid = await initializeAndPay(buyer, placed.checkoutId, processingFeeMinor);
    paidTotal = paid.amountMinor;
    expect(paidTotal).toBe(2 * (itemPriceMinor + 150_000));
    expect(psql(`select count(*) from payments.payment_intents where subject_id = '${placed.checkoutId}'`)[0]?.[0]).toBe("1");
    const held = await Promise.all([waitForEscrowStatus(orderA, "held"), waitForEscrowStatus(orderB, "held")]);
    expect(held[0], "escrow A not held").toBeDefined();
    expect(held[1], "escrow B not held").toBeDefined();
    const groupTotal = itemPriceMinor + 150_000;
    for (const row of held as string[][]) {
      expect(Number(row[2]), "escrow fee bps").toBe(150);
      expect(Number(row[3]), "escrow fee 1.5%").toBe(Math.round(groupTotal * 0.015));
    }
    expect(Number(held[0]![5]) + Number(held[1]![5]), "processing fee allocated across both groups").toBe(processingFeeMinor);
    expect(Number(held[0]![5]), "pro-rata fee for equal groups").toBe(processingFeeMinor / 2);
  });

  it("books the processing fee as an expense line apart from the escrow fee at payment", async () => {
    const lines = psql(`select a.code, l.direction, l.amount_minor from ledger.journal_entries e join ledger.journal_lines l on l.entry_id = e.id join ledger.ledger_accounts a on a.id = l.account_id where e.kind in ('payment.received','escrow.held') and e.created_at > now() - interval '5 minutes' order by e.created_at, l.line_number`);
    const codes = lines.map((line) => line[0] ?? "");
    expect(codes.some((code) => code.startsWith("expense:paymentProcessingFees")), JSON.stringify(lines)).toBe(true);
    expect(codes.some((code) => code.startsWith("liability:platformFeesUnearned"))).toBe(true);
  });

  it("releases automatically 3 days after delivery (timer set to 72h, then time-travelled), then holds the credit for 24h", { timeout: 120_000 }, async () => {
    await shipAndDeliver(storeA, orderA);
    const timer = await waitFor(async () => {
      const seconds = psql(`select extract(epoch from (auto_release_at - delivered_at)) from escrow.escrows where order_id = '${orderA}'`)[0]?.[0];
      return seconds ? seconds : undefined;
    }, 30_000, 500);
    expect(Number(timer), "auto-release timer after delivery").toBe(72 * 3600);
    expect((await waitForEscrowStatus(orderA, "held"))?.[0]).toBe("held");
    psql(`update escrow.escrows set auto_release_at = now() - interval '1 minute' where order_id = '${orderA}'`);
    const released = await waitForEscrowStatus(orderA, "released", 90_000);
    expect(released, "escrow was not auto-released").toBeDefined();
    expect(released?.[1]).toMatch(/auto/i);
    const lockHours = psql(`select round(extract(epoch from (available_at - created_at)) / 3600) from ledger.seller_credit_maturities order by created_at desc limit 1`)[0]?.[0];
    expect(Number(lockHours), "24h lock").toBe(24);
    const wallet = await callApi("GET", "/api/v1/wallets/me", { token: storeA.seller.accessToken, headers: ngn });
    expect(wallet.status, describeResponse(wallet)).toBe(200);
    const expectedNet = itemPriceMinor + 150_000 - Math.round((itemPriceMinor + 150_000) * 0.015) - processingFeeMinor / 2;
    expect(wallet.body.available?.amountMinor ?? 0, "nothing withdrawable during the lock").toBe(0);
    expect(wallet.body.pending?.amountMinor ?? 0, "pending is money still in escrow; released money is locked").toBe(0);
    expect(wallet.body.locked?.amountMinor ?? 0, describeResponse(wallet)).toBe(expectedNet);
  });

  it("refuses a withdrawal before business verification and during the lock, then pays out after the lock passes", { timeout: 240_000 }, async () => {
    await onboardPayoutAccount(storeA.seller);
    const created = await callApi("POST", "/api/v1/wallets/me/payout-accounts", { token: storeA.seller.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(storeA.seller) }, body: { bankCode: "058", accountNumber: "0123456789", countryCode: "NG" } });
    expect([200, 201], describeResponse(created)).toContain(created.status);
    const payoutAccountId: string = created.body.id ?? created.body.payoutAccount?.id;
    const unverified = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: storeA.seller.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(storeA.seller) }, body: { payoutAccountId, amount: { amountMinor: 500_000, currency: "NGN" } } });
    expectClearError(unverified, 403, "SELLER_VERIFICATION_REQUIRED");
    await verifySellerBusiness(staff, storeA.seller);
    const early = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: storeA.seller.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(storeA.seller) }, body: { payoutAccountId, amount: { amountMinor: 500_000, currency: "NGN" } } });
    expect(early.status, `withdrawal during the 24h lock must be refused: ${describeResponse(early)}`).toBeGreaterThanOrEqual(400);
    psql(`update ledger.seller_credit_maturities set available_at = now() - interval '1 minute' where matured_at is null`);
    const available = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/wallets/me", { token: storeA.seller.accessToken, headers: ngn });
      return (response.body.available?.amountMinor ?? 0) > 0 ? response : undefined;
    }, 90_000, 2000);
    expect(available, "credit never matured after the lock").toBeDefined();
    const amountMinor: number = available?.body.available.amountMinor;
    const requested = (await waitFor(async () => {
      const response = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: storeA.seller.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(storeA.seller) }, body: { payoutAccountId, amount: { amountMinor, currency: "NGN" } } });
      return response.body?.code === "PAYOUT_ACCOUNT_NOT_VERIFIED" ? undefined : response;
    }, 60_000, 2000))!;
    expect([200, 201, 202], describeResponse(requested)).toContain(requested.status);
    const withdrawalId: string = requested.body.id ?? requested.body.withdrawal?.id;
    const reviewing = /review|pending/i.test(JSON.stringify(requested.body));
    if (reviewing) {
      const review = await callApi("POST", `/api/v1/admin/withdrawals/${withdrawalId}/review`, { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaffForMoneyAction(staff) }, body: { decision: "approve", reason: "Smoke approval" } });
      expect([200, 201, 204], describeResponse(review)).toContain(review.status);
    }
    const run = await callApi("POST", "/api/v1/admin/payouts/run", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaffForMoneyAction(staff) }, body: {} });
    expect([200, 201, 202, 204, 404], describeResponse(run)).toContain(run.status);
    const transfer = await waitFor(async () => {
      const state = await readProviderState();
      return Object.values(state.transfers).find((candidate) => isOpenProviderTransfer(candidate) && candidate.AmountMinor === requested.body.netAmount?.amountMinor);
    }, 60_000, 1000);
    expect(transfer, "no payout transfer reached the provider").toBeDefined();
    await settleTransferThroughProvider(transfer!.Reference);
    const completed = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/wallets/me/withdrawals", { token: storeA.seller.accessToken });
      return /completed|paid|success/i.test(JSON.stringify(response.body)) ? response : undefined;
    }, 30_000, 1000);
    expect(completed, "withdrawal never completed").toBeDefined();
  });

  it("refunds an escrow order that the seller rejects, returning the full amount without an escrow fee", async () => {
    await addToCart(buyer, storeB, 1);
    const placed = await checkout(buyer, addressId);
    const orderId = placed.orderIds[0]!;
    await initializeAndPay(buyer, placed.checkoutId, 20_000);
    expect((await waitForEscrowStatus(orderId, "held"))?.[0]).toBe("held");
    const rejected = await waitFor(async () => {
      const response = await callApi("POST", `/api/v1/seller/orders/${orderId}/reject`, { token: storeB.seller.accessToken, headers: { "x-store-id": storeB.storeId }, body: { reason: "Out of stock" } });
      return response.status === 409 ? undefined : response;
    }, 20_000, 1000);
    expect([200, 201, 204], rejected === undefined ? "order never became rejectable" : describeResponse(rejected)).toContain(rejected?.status);
    const refunded = await waitForEscrowStatus(orderId, "refunded", 30_000);
    expect(refunded, "escrow was not refunded").toBeDefined();
    const state = await waitFor(async () => {
      const current = await readProviderState();
      return Array.isArray(current.refunds) && current.refunds.length > 0 ? current : undefined;
    }, 30_000, 500);
    expect(state, "provider never received the refund sent through the outbox").toBeDefined();
    const feeLines = psql(`select a.code, l.amount_minor from escrow.escrows x join ledger.journal_entries e on e.reference like '%' || x.id::text || '%' join ledger.journal_lines l on l.entry_id = e.id join ledger.ledger_accounts a on a.id = l.account_id where x.order_id = '${orderId}' and e.kind like 'escrow.refund%' and a.code like 'revenue:escrowFees%'`);
    expect(feeLines.length, "refunds must not earn an escrow fee").toBe(0);
  });

  it("pays a verified store directly: rejects direct for unverified stores, pays the seller at once, then refunds through the seller", { timeout: 120_000 }, async () => {
    const direct = await createStoreWithProduct("sellerd", itemPriceMinor);
    await addToCart(buyer, direct, 1);
    const refusedDirect = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId, paymentModes: [{ storeId: direct.storeId, paymentMode: "direct" }] } });
    expect(refusedDirect.status, describeResponse(refusedDirect)).toBe(422);
    expect(refusedDirect.body?.error?.code ?? refusedDirect.body?.code).toBe("DIRECT_PAYMENT_NOT_ALLOWED");
    psql(`update catalog.stores set verified = true where id = '${direct.storeId}'`);
    await verifySellerBusiness(staff, direct.seller);
    await onboardPayoutAccount(direct.seller, "seller");
    const placed = await checkout(buyer, addressId, { [direct.storeId]: "direct" });
    const orderId = placed.orderIds[0]!;
    expect(psql(`select payment_mode from orders.order_groups where id = '${orderId}'`)[0]?.[0]).toBe("direct");
    const initialized = await waitFor(async () => {
      const response = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
      return response.body?.code === "SELLER_NOT_READY_FOR_PAYMENTS" ? undefined : response;
    }, 30_000, 1000);
    expect(initialized?.status, initialized === undefined ? "the seller subaccount never became ready" : describeResponse(initialized)).toBe(201);
    await payCheckoutThroughProvider(initialized!.body.reference, 20_000);
    const released = await waitForEscrowStatus(orderId, "released");
    expect(released, "direct order must be released to the seller immediately").toBeDefined();
    expect(psql(`select payment_mode, release_trigger from escrow.escrows where order_id = '${orderId}'`)[0]).toEqual(["direct", "directPayment"]);
    const detail = await callApi("GET", `/api/v1/orders/${orderId}`, { token: buyer.accessToken });
    expect(detail.body.paymentMode, describeResponse(detail)).toBe("direct");
    const rejected = await waitFor(async () => {
      const response = await callApi("POST", `/api/v1/seller/orders/${orderId}/reject`, { token: direct.seller.accessToken, headers: { "x-store-id": direct.storeId }, body: { reason: "Smoke refund of a direct order" } });
      return response.status === 409 ? undefined : response;
    }, 20_000, 1000);
    expect([200, 201, 204], rejected === undefined ? "direct order never became rejectable" : describeResponse(rejected)).toContain(rejected?.status);
    const refunded = await waitForEscrowStatus(orderId, "refunded", 30_000);
    expect(refunded, "direct order was not refunded").toBeDefined();
    const debt = psql(`select l.amount_minor from ledger.journal_entries e join ledger.journal_lines l on l.entry_id = e.id join ledger.ledger_accounts a on a.id = l.account_id where e.kind = 'directPayment.refundedFromPlatform' and a.code like 'seller:%debt%'`);
    expect(debt.length, "refund of a direct order must book a seller debt").toBeGreaterThan(0);
  });
});
