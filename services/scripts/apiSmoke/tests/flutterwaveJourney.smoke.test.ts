import { afterAll, describe, expect, it } from "vitest";

import { createSuperadmin, registerUser, stepUpStaff, stepUpStaffForMoneyAction, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { addToCart, approveSellerApplication, checkout, createBuyerWithAddress, createStoreWithProduct, psql, shipAndDeliver, type SmokeStore } from "../src/commerceFixtures.util.js";
import { uploadSampleImage } from "../src/mediaUpload.util.js";
import {
  deliverFlutterwaveWebhook, finishTransfer, fundWallet, payCardCheckout, readFakeFlutterwaveState, readWallet, settle, signFunding,
  userStepUp, verifyNigerianUserToLevelOne,
} from "../src/fakeFlutterwave.util.js";
import { verifySellerBusiness } from "../src/sellerVerification.util.js";

const slow = 300_000;

async function placeOrder(buyer: UserActor, addressId: string, store: SmokeStore): Promise<{ orderId: string; reference: string }> {
  await addToCart(buyer, store, 1);
  const placed = await checkout(buyer, addressId);
  const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
  expect(initialized.status, describeResponse(initialized)).toBe(201);
  return { orderId: placed.orderIds[0]!, reference: initialized.body.reference };
}

describe("Flutterwave money journeys through the gateway", () => {
  let staff: StaffActor;
  let store: SmokeStore;
  let buyer: UserActor;
  let addressId = "";
  let buyerAccountNumber = "";
  let restoreEscrowPolicy: (() => Promise<void>) | null = null;

  afterAll(async () => {
    await restoreEscrowPolicy?.();
  });

  it("verifies a Nigerian buyer to L1, opens the wallet, rejects forged and replayed deposits, sweeps the fee and releases the hold", async () => {
    staff = await createSuperadmin();
    restoreEscrowPolicy = await releaseSellerCreditImmediately(staff);
    store = await createStoreWithProduct("fwseller", 250_000);
    await verifyNigerianUserToLevelOne(store.seller);
    await verifySellerBusiness(staff, store.seller);
    ({ buyer, addressId } = await createBuyerWithAddress());
    ({ accountNumber: buyerAccountNumber } = await verifyNigerianUserToLevelOne(buyer));
    const signed = await signFunding(buyerAccountNumber, 1_000_000, `PSA_SMOKE${uniqueSuffix()}`);
    const forged = await deliverFlutterwaveWebhook(signed, "forged-forged-forged-forged-forged-0000");
    expect(forged.status, describeResponse(forged)).toBe(401);
    const replays = await Promise.all(Array.from({ length: 6 }, () => deliverFlutterwaveWebhook(signed)));
    expect(replays.every((response) => response.status === 200), replays.map(describeResponse).join(" | ")).toBe(true);
    const swept = await waitFor(async () => {
      const balances = await readWallet(buyer);
      return balances.outgoingMinor === 0 && balances.availableMinor + balances.depositHoldMinor > 0 ? balances : undefined;
    }, 120_000, 2000);
    expect(swept, "deposit fee never swept").toBeDefined();
    expect(swept!.availableMinor + swept!.depositHoldMinor).toBe(1_000_000 - 5_000 - Math.ceil((995_000 * 50) / 10_000));
  }, slow);

  it("buys with the wallet, locks escrow in the buyer's wallet, releases to the seller's wallet and lets the seller withdraw with step-up", async () => {
    const order = await placeOrder(buyer, addressId, store);
    const paid = await callApi("POST", `/api/v1/payments/wallet-payments/${order.reference}`, { token: buyer.accessToken });
    expect(paid.status, describeResponse(paid)).toBe(200);
    expect((await readWallet(buyer)).escrowLockedMinor).toBeGreaterThan(0);
    await shipAndDeliver(store, order.orderId);
    const confirmed = await callApi("POST", `/api/v1/orders/${order.orderId}/confirm-receipt`, { token: buyer.accessToken, body: {} });
    expect([200, 201], describeResponse(confirmed)).toContain(confirmed.status);
    const sellerFunded = await waitFor(async () => {
      const balances = await readWallet(store.seller);
      return balances.availableMinor > 0 ? balances : undefined;
    }, 150_000, 3000);
    expect(sellerFunded, "seller wallet never received the release").toBeDefined();
    const stepUp = await userStepUp(store.seller);
    const account = await callApi("POST", "/api/v1/wallets/me/payout-accounts", { token: store.seller.accessToken, headers: { "x-step-up-token": stepUp }, body: { bankCode: "058", accountNumber: "0123456789", countryCode: "NG" } });
    expect([200, 201], describeResponse(account)).toContain(account.status);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const unprotected = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: store.seller.accessToken, body: { payoutAccountId: account.body.id, amount: { amountMinor: 50_000, currency: "NGN" } } });
    expect(unprotected.status, describeResponse(unprotected)).toBe(403);
    const withdrawal = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: store.seller.accessToken, headers: { "x-step-up-token": await userStepUp(store.seller) }, body: { payoutAccountId: account.body.id, amount: { amountMinor: 50_000, currency: "NGN" } } });
    expect([200, 201], describeResponse(withdrawal)).toContain(withdrawal.status);
    if (withdrawal.body.withdrawalStatus === "pending_review") {
      const approved = await callApi("POST", `/api/v1/admin/withdrawals/${withdrawal.body.id}/review`, { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaffForMoneyAction(staff) }, body: { decision: "approve", reason: "Smoke approval" } });
      expect(approved.status, describeResponse(approved)).toBe(200);
    }
    const run = await callApi("POST", "/api/v1/admin/payouts/run", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaffForMoneyAction(staff) }, body: {} });
    expect([200, 202], describeResponse(run)).toContain(run.status);
    const reference: string = withdrawal.body.reference;
    const transfer = (await readFakeFlutterwaveState()).transfers[reference];
    expect(transfer?.DebitSubaccount, "withdrawal must debit the seller's own wallet").toMatch(/^PSA/);
    expect(transfer?.SkipBeneficiary).toBe(true);
    await finishTransfer(reference, "successful");
    const done = await waitFor(async () => {
      const list = await callApi("GET", "/api/v1/wallets/me/withdrawals", { token: store.seller.accessToken });
      return list.body.data?.find((row: { reference: string; withdrawalStatus: string }) => row.reference === reference && row.withdrawalStatus === "paid");
    }, 30_000, 1000);
    expect(done, "withdrawal never completed").toBeDefined();
    expect((await readFakeFlutterwaveState()).requests.some((line) => line.includes("/retries"))).toBe(false);
  }, slow);

  it("refunds a card buyer before settlement back to the card", async () => {
    const { buyer: cardBuyer, addressId: cardAddress } = await createBuyerWithAddress();
    const order = await placeOrder(cardBuyer, cardAddress, store);
    await payCardCheckout(order.reference, 3_750);
    const refunded = await callApi("POST", `/api/v1/admin/orders/${order.orderId}/escrow/refund`, { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaffForMoneyAction(staff) }, body: { reason: "Smoke card refund" } });
    expect(refunded.status, describeResponse(refunded)).toBe(200);
    const providerRefund = await waitFor(async () => {
      const state = await readFakeFlutterwaveState();
      return (state.refunds ?? []).length > 0 ? state.refunds : undefined;
    }, 60_000, 2000);
    expect(providerRefund, "the refund never reached the card").toBeDefined();
    await settle("NGN");
  }, slow);

  it("blocks an unverified Ghanaian seller from publishing and lets a verified one sell directly with no escrow", async () => {
    const unverified = await createGhanaStore("ghblock");
    const blocked = await callApi("POST", "/api/v1/seller/products", { token: unverified.seller.accessToken, headers: { "x-store-id": unverified.storeId }, body: ghanaProduct(unverified.imageMediaId) });
    expect(blocked.status, describeResponse(blocked)).toBe(403);
    expect(blocked.body.code).toBe("VERIFICATION_REQUIRED");
    expect(typeof blocked.body.verifyUrl).toBe("string");
    const verified = await createGhanaStore("ghsell");
    psql(`insert into users.verification_cases (id, created_at, updated_at, profile_id, account_id, color, subscription_id, status, liveness_result, face_match_result, decision_reasons, fraud_signals) select gen_random_uuid(), now(), now(), p.id, p.account_id, 'blue', 'smoke-' || p.account_id, 'approved', 'passed', 'passed', '[]'::jsonb, '[]'::jsonb from users.profiles p where p.account_id = '${verified.seller.accountId}' and p.kind = 'personal' limit 1`);
    const allowed = await waitFor(async () => {
      const response = await callApi("POST", "/api/v1/seller/products", { token: verified.seller.accessToken, headers: { "x-store-id": verified.storeId }, body: ghanaProduct(verified.imageMediaId) });
      return response.status === 201 ? response : undefined;
    }, 70_000, 5000);
    expect(allowed, "a verified Ghanaian seller must be able to publish").toBeDefined();
  }, slow);
});

async function createGhanaStore(label: string): Promise<{ seller: UserActor; storeId: string; imageMediaId: string }> {
  const suffix = uniqueSuffix();
  const seller = await registerUser(label);
  approveSellerApplication(seller.accountId);
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: seller.accessToken, body: { countryCode: "GH" } });
  const profile = await callApi("POST", "/api/v1/users/me/business-profiles", { token: seller.accessToken, body: { displayName: `Smoke ${label} ${suffix}`, handle: `sm${label}${suffix}`.slice(0, 30), description: "Smoke store", businessType: "business", categories: [{ customName: "Fashion" }] } });
  expect(profile.status, describeResponse(profile)).toBe(201);
  const store = await callApi("POST", "/api/v1/stores", { token: seller.accessToken, body: { businessProfileId: profile.body.id ?? profile.body.profile?.id, name: `Smoke ${label} ${suffix}`, description: "Smoke store", countryCode: "GH" } });
  expect(store.status, describeResponse(store)).toBe(201);
  const image = await uploadSampleImage(seller.accessToken, "product");
  return { seller, storeId: store.body.id ?? store.body.store?.id, imageMediaId: image.mediaId };
}

function ghanaProduct(imageMediaId: string): Record<string, unknown> {
  const suffix = uniqueSuffix();
  return { name: `Smoke Ghana item ${suffix}`, description: "Smoke item", status: "active", taxable: false, trackInventory: false, publishedOnline: true, tags: ["smoke"], options: [], imageMediaIds: [imageMediaId], variants: [{ optionValues: {}, sku: `SM-GH-${suffix}`.toUpperCase(), priceMinor: 10_000, lowStockThreshold: 1, openingStock: [] }] };
}

async function releaseSellerCreditImmediately(staff: StaffActor): Promise<() => Promise<void>> {
  const current = await callApi("GET", "/api/v1/admin/config/escrow.policy", { token: staff.accessToken });
  expect(current.status, describeResponse(current)).toBe(200);
  const relaxed = await callApi("PUT", "/api/v1/admin/config/escrow.policy", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: { ...current.body.value, sellerCreditHoldHours: 0 }, expectedVersion: current.body.version, reason: "API smoke run releases seller credit at once" } });
  expect(relaxed.status, describeResponse(relaxed)).toBe(200);
  return async () => {
    const latest = await callApi("GET", "/api/v1/admin/config/escrow.policy", { token: staff.accessToken });
    await callApi("PUT", "/api/v1/admin/config/escrow.policy", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: current.body.value, expectedVersion: latest.body.version, reason: "Restore after API smoke run" } });
  };
}
