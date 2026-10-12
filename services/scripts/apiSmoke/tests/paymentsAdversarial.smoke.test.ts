import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, stepUpUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { addToCart, checkout, createBuyerWithAddress, createStoreWithProduct, onboardPayoutAccount, psql, shipAndDeliver, type SmokeStore } from "../src/commerceFixtures.util.js";
import { deliverFlutterwaveWebhook, payCheckoutThroughProvider, readWallet, settle, signCardCompletion, verifyNigerianUserToLevelOne } from "../src/fakeFlutterwave.util.js";
import { expectClearError, expectLedgerBalancedSince, sleep } from "../src/journeyChecks.util.js";
import { approveExistingUserAsCreator, withRelaxedCreatorThresholds } from "../src/liveFixtures.util.js";
import { verifySellerBusiness } from "../src/sellerVerification.util.js";

const slow = { timeout: 300_000 };
const ngn = { "x-client-region": "NG" };

async function initialize(buyer: UserActor, checkoutId: string): Promise<string> {
  const initialized = await waitFor(async () => {
    const response = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId } });
    return response.body?.code === "SELLER_NOT_READY_FOR_PAYMENTS" ? undefined : response;
  }, 30_000, 1000);
  expect(initialized?.status, initialized === undefined ? "seller never became ready" : describeResponse(initialized)).toBe(201);
  return initialized!.body.reference;
}

function commissionOf(orderId: string): string[] | undefined {
  return psql(`select status, commission_minor, reversed_minor from creators.affiliate_commissions where order_id = '${orderId}'`)[0];
}

function creatorDebtMinor(creatorId: string): number {
  const row = psql(`select coalesce(sum(case when l.direction = 'debit' then l.amount_minor else -l.amount_minor end), 0) from ledger.journal_lines l join ledger.ledger_accounts a on a.id = l.account_id where a.code like '%${creatorId}%' and a.code ilike '%debt%'`)[0];
  return Math.abs(Number(row?.[0] ?? 0));
}

describe("payments adversarial checks against the live stack", () => {
  let staff: StaffActor;
  let store: SmokeStore;

  beforeAll(async () => {
    staff = await createSuperadmin();
    store = await createStoreWithProduct("payadv", 5_000_000);
  }, slow.timeout);

  it("a retried card webhook settles the payment once", slow, async () => {
    const { buyer, addressId } = await createBuyerWithAddress();
    await addToCart(buyer, store, 1);
    const placed = await checkout(buyer, addressId);
    const reference = await initialize(buyer, placed.checkoutId);
    const signed = await signCardCompletion(reference, 10_000);
    const deliveries = await Promise.all(Array.from({ length: 4 }, () => deliverFlutterwaveWebhook(signed)));
    expect(deliveries.every((delivery) => delivery.status === 200), deliveries.map(describeResponse).join(" | ")).toBe(true);
    const late = await deliverFlutterwaveWebhook(signed);
    expect(late.status, describeResponse(late)).toBe(200);
    const orderId = placed.orderIds[0]!;
    expect(await waitFor(async () => psql(`select status from escrow.escrows where order_id = '${orderId}'`)[0]?.[0] === "held" || undefined, 30_000, 500)).toBe(true);
    expect(psql(`select count(*) from payments.payment_intents where subject_id = '${placed.checkoutId}' and status = 'succeeded'`)[0]?.[0]).toBe("1");
    expect(psql(`select count(*) from escrow.escrows where order_id = '${orderId}'`)[0]?.[0]).toBe("1");
    expect(psql(`select kind, count(*) from ledger.journal_entries where reference like '%${reference}%' group by kind having count(*) > 1`), "no journal kind is posted twice for the reference").toEqual([]);
    expect(psql(`select count(*) from ledger.journal_entries where reference = 'payment-received:${reference}'`)[0]?.[0], "the payment is received once").toBe("1");
    expectLedgerBalancedSince(15);
  });

  it("refuses a withdrawal in a currency that has no daily cap", slow, async () => {
    const user = (await createBuyerWithAddress()).buyer;
    await onboardPayoutAccount(user);
    const account = await callApi("POST", "/api/v1/wallets/me/payout-accounts", { token: user.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(user) }, body: { bankCode: "058", accountNumber: "0123456789", countryCode: "NG" } });
    expect([200, 201], describeResponse(account)).toContain(account.status);
    const payoutAccountId: string = account.body.id ?? account.body.payoutAccount?.id;
    await sleep(2_500);
    for (const [currency, code] of [["USD", "WITHDRAWAL_CURRENCY_NOT_AVAILABLE"], ["XOF", "WITHDRAWAL_CURRENCY_NOT_SUPPORTED"]] as const) {
      const refused = await callApi("POST", "/api/v1/wallets/me/withdrawals", { token: user.accessToken, headers: { ...ngn, "x-step-up-token": await stepUpUser(user) }, body: { payoutAccountId, amount: { amountMinor: 50_000, currency } } });
      expectClearError(refused, 422, code);
      expect(psql(`select count(*) from wallet.withdrawals where user_id = '${user.accountId}' and currency = '${currency}'`)[0]?.[0]).toBe("0");
    }
  });

  it("an affiliate commission paid out and then refunded becomes creator debt and makes the seller whole", { timeout: 600_000 }, async () => {
    psql(`update catalog.stores set verified = true where id = '${store.storeId}'`);
    await verifySellerBusiness(staff, store.seller);
    await onboardPayoutAccount(store.seller, "seller");
    const creatorAsBuyer = await createBuyerWithAddress();
    const creator = await withRelaxedCreatorThresholds(staff, () => approveExistingUserAsCreator(staff, creatorAsBuyer.buyer));
    const cheap = await createStoreWithProduct("affcheap", 100_000);
    await verifyNigerianUserToLevelOne(creator);
    const headers = { "x-store-id": store.storeId, "x-seller-store": store.storeId };
    const settings = await callApi("PATCH", "/api/v1/seller/affiliates/settings", { token: store.seller.accessToken, headers, body: { enabled: true, defaultCommissionBasisPoints: 1000 } });
    expect(settings.status, describeResponse(settings)).toBe(200);
    const requested = await callApi("POST", "/api/v1/creators/affiliations", { token: creator.accessToken, body: { storeId: store.storeId, productId: store.productId, message: "Smoke affiliate" } });
    expect([200, 201], describeResponse(requested)).toContain(requested.status);
    const pending = await callApi("GET", "/api/v1/seller/affiliates/requests", { token: store.seller.accessToken, headers });
    const request = (pending.body.data ?? pending.body.items ?? []).find((item: any) => (item.creatorId ?? item.creator?.id) === creator.accountId);
    if (request !== undefined) {
      const approved = await callApi("POST", `/api/v1/seller/affiliates/requests/${request.id}/approve`, { token: store.seller.accessToken, headers, body: {} });
      expect(approved.status, describeResponse(approved)).toBeLessThan(300);
    }
    const post = await callApi("POST", "/api/v1/posts", { token: creator.accessToken, body: { text: "Loving this piece", audience: "everyone" } });
    expect(post.status, describeResponse(post)).toBe(201);

    const { buyer, addressId } = await createBuyerWithAddress();
    const added = await callApi("POST", "/api/v1/cart/items", { token: buyer.accessToken, body: { productId: store.productId, variantId: store.variantId, quantity: 1, attribution: { source: "post", id: post.body.id } } });
    expect([200, 201], describeResponse(added)).toContain(added.status);
    const placed = await checkout(buyer, addressId, { [store.storeId]: "direct" });
    const orderId = placed.orderIds[0]!;
    await payCheckoutThroughProvider(await initialize(buyer, placed.checkoutId), 20_000);
    await settle("NGN");
    await shipAndDeliver(store, orderId);
    const confirmed = await callApi("POST", `/api/v1/orders/${orderId}/confirm-receipt`, { token: buyer.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(confirmed)).toContain(confirmed.status);
    const paid = await waitFor(async () => (commissionOf(orderId)?.[0] === "paid" ? commissionOf(orderId) : undefined), 150_000, 3000);
    expect(paid, `commission never paid: ${JSON.stringify(commissionOf(orderId))}`).toBeDefined();
    const commissionMinor = Number(paid![1]);
    expect(commissionMinor).toBe(500_000);

    psql(`update payments.wallet_fundings set hold_release_at = now() - interval '1 minute' where user_id = '${creator.accountId}' and status = 'held'`);
    await addToCart(creator, cheap, 1);
    const spendOrder = await checkout(creator, creatorAsBuyer.addressId);
    const spendReference = await initialize(creator, spendOrder.checkoutId);
    const spent = await callApi("POST", `/api/v1/payments/wallet-payments/${spendReference}`, { token: creator.accessToken });
    expect(spent.status, `the creator spends the commission from the wallet: ${describeResponse(spent)} ${JSON.stringify(await readWallet(creator))}`).toBe(200);
    const sellerBefore = await readWallet(store.seller);

    const refund = await callApi("POST", `/api/v1/seller/orders/${orderId}/refunds`, { token: store.seller.accessToken, headers, body: { amountMinor: Number(psql(`select total_minor from orders.order_groups where id = '${orderId}'`)[0]?.[0]), reason: "Smoke refund after the commission was paid" } });
    expect([200, 201], describeResponse(refund)).toContain(refund.status);
    const reversed = await waitFor(async () => (commissionOf(orderId)?.[0] === "reversed" ? commissionOf(orderId) : undefined), 150_000, 3000);
    expect(reversed, `commission never reversed: ${JSON.stringify(commissionOf(orderId))}`).toBeDefined();
    const debt = await waitFor(async () => (creatorDebtMinor(creator.accountId) > 0 ? creatorDebtMinor(creator.accountId) : undefined), 150_000, 3000);
    expect(debt, "the spent part of the commission becomes creator debt").toBeDefined();
    const sellerAfter = await readWallet(store.seller);
    expect(sellerAfter.availableMinor + sellerAfter.depositHoldMinor + sellerAfter.debtMinor, "the seller is made whole for the commission").toBeGreaterThanOrEqual(sellerBefore.availableMinor + sellerBefore.depositHoldMinor);
    expectLedgerBalancedSince(30);
  });
});
