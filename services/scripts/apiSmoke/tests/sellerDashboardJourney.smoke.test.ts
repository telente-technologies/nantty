import { beforeAll, describe, expect, it } from "vitest";

import { stepUpUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { addToCart, adjustStock, bankAccountNumberFor, checkout, createBuyerWithAddress, createStoreWithProduct, onboardPayoutAccount, psql, shipAndDeliver, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider, readWallet, settleCardPaymentsFor } from "../src/fakeFlutterwave.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";

describe("seller dashboard journey: product → stock → order → fulfil → payout view, on the free plan", () => {
  let store: SmokeStore;
  let buyer: UserActor;
  let addressId = "";
  let orderId = "";
  let token = "";
  const seller = (method: string, path: string, options: { body?: unknown; idempotencyKey?: string; stepUpToken?: string } = {}) =>
    callApi(method, path, {
      token,
      headers: { "x-seller-store": store.storeId, ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}), ...(options.stepUpToken ? { "x-step-up-token": options.stepUpToken } : {}) },
      body: options.body,
    });

  beforeAll(async () => {
    store = await createStoreWithProduct("dashjourney", 600_000, 10);
    token = store.seller.accessToken;
    ({ buyer, addressId } = await createBuyerWithAddress());
  });

  it("adds stock and edits settings, storefront, delivery areas and customers", async () => {
    await adjustStock(store, 5);
    const settings = await seller("GET", "/api/v1/seller/settings");
    expect(settings.status, describeResponse(settings)).toBe(200);
    expect(settings.body.currency).toBe("NGN");
    const saved = await seller("PATCH", "/api/v1/seller/settings", { body: { phone: "+2348011112222", policies: { returns: "Returns within 7 days.", shipping: "Ships in 48 hours.", privacy: "" } } });
    expect(saved.status, describeResponse(saved)).toBe(200);
    expect(saved.body.phone).toBe("+2348011112222");
    expectClearError(await seller("PATCH", "/api/v1/seller/settings", { body: { notifications: { lowStockEmail: true } } }), 402, "PLAN_FEATURE_REQUIRED");
    expectClearError(await seller("PATCH", "/api/v1/seller/settings", { body: { currency: "USD" } }), 400);
    const area = await seller("POST", "/api/v1/seller/delivery/areas", { body: { name: "Lekki", state: "Lagos", cities: ["Lekki", "Ajah"], feeMinor: 150_000, estimatedDaysMin: 1, estimatedDaysMax: 2, active: true } });
    expect(area.status, describeResponse(area)).toBe(201);
    const storefront = await seller("PATCH", "/api/v1/seller/storefront", { body: { tagline: "Smoke adire", socialLinks: { instagram: "@smokeadire", tiktok: null, x: null, whatsapp: null, facebook: null, website: null } } });
    expect(storefront.status, describeResponse(storefront)).toBe(200);
    expect(storefront.body.deliveryAreas).toContain("Lekki, Lagos");
    const customer = await seller("POST", "/api/v1/seller/customers", { body: { name: "Walk-in Bayo", phone: `0802${String(Date.now()).slice(-7)}`, tags: ["wholesale"] } });
    expect(customer.status, describeResponse(customer)).toBe(201);
    expectClearError(await seller("POST", "/api/v1/seller/customers", { body: { name: "Bayo again", phone: customer.body.phone } }), 409, "CUSTOMER_EXISTS");
    expectClearError(await seller("POST", "/api/v1/seller/staff", { body: { userId: buyer.accountId, role: "sales", locationIds: [store.locationId] } }), 402, "PLAN_FEATURE_REQUIRED");
    const candidates = await seller("GET", `/api/v1/seller/zudomart-users?q=${encodeURIComponent(buyer.username.slice(0, 6))}`);
    expect(candidates.status, describeResponse(candidates)).toBe(200);
    expect(JSON.stringify(candidates.body)).not.toMatch(/@|phone/i);
  });

  it("takes an app order that shows on the dashboard", { timeout: 90_000 }, async () => {
    await addToCart(buyer, store, 1);
    const placed = await checkout(buyer, addressId);
    orderId = placed.orderIds[0]!;
    const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    await payCheckoutThroughProvider(initialized.body.reference);
    expect(await waitFor(async () => (psql(`select payment_status from orders.order_groups where id = '${orderId}'`)[0]?.[0] === "paid" ? true : undefined), 20_000, 500)).toBe(true);
    const dashboard = await seller("GET", "/api/v1/seller/dashboard");
    expect(dashboard.status, describeResponse(dashboard)).toBe(200);
    expect(dashboard.body.recentOrders.map((order: { id: string }) => order.id)).toContain(orderId);
    expect(dashboard.body.dailyRevenue).toHaveLength(30);
    expect(dashboard.body.alerts.map((alert: { kind: string }) => alert.kind)).toContain("orders_to_accept");
    expect(dashboard.body.balances).not.toBeNull();
  });

  it("fulfils the order and shows the released money in finance and the wallet", { timeout: 240_000 }, async () => {
    await onboardPayoutAccount(store.seller);
    await shipAndDeliver(store, orderId);
    await settleCardPaymentsFor([orderId]);
    const confirmed = await callApi("POST", `/api/v1/orders/${orderId}/confirm-receipt`, { token: buyer.accessToken, body: {} });
    expect([200, 201], describeResponse(confirmed)).toContain(confirmed.status);
    const escrow = await waitFor(async () => {
      const response = await seller("GET", "/api/v1/seller/finance/escrow");
      return response.status === 200 && response.body.countsByStatus?.released >= 1 ? response : undefined;
    }, 30_000, 1000);
    expect(escrow, "finance never showed the released escrow").toBeDefined();
    const settlements = await seller("GET", "/api/v1/seller/finance/settlements");
    expect(settlements.body.data.length, describeResponse(settlements)).toBeGreaterThan(0);
    for (const path of ["/api/v1/seller/finance/summary", "/api/v1/seller/finance/fees", "/api/v1/seller/finance/statements", "/api/v1/seller/wallet/transactions", "/api/v1/seller/wallet/payout-settings"]) {
      const response = await seller("GET", path);
      expect(response.status, `${path}: ${describeResponse(response)}`).toBe(200);
    }
    const credited = await waitFor(async () => {
      const balances = await readWallet(store.seller);
      return balances.availableMinor + balances.depositHoldMinor > 0 ? balances : undefined;
    }, 150_000, 3000);
    expect(credited, "the released money never reached the seller balances").toBeDefined();
  });

  it("adds a payout account through the two-step lookup and refuses a payout it cannot cover", { timeout: 90_000 }, async () => {
    const resolved = await seller("POST", "/api/v1/seller/wallet/payout-accounts/resolve", { body: { bankCode: "058", accountNumber: bankAccountNumberFor(store.seller.accountId) } });
    expect(resolved.status, describeResponse(resolved)).toBe(200);
    expect(JSON.stringify(resolved.body)).not.toContain(bankAccountNumberFor(store.seller.accountId));
    const account = await seller("POST", "/api/v1/seller/wallet/payout-accounts", { body: { resolutionId: resolved.body.resolutionId }, idempotencyKey: `acct-${uniqueSuffix()}`, stepUpToken: await stepUpUser(store.seller) });
    expect([201, 409], describeResponse(account)).toContain(account.status);
    const accounts = await seller("GET", "/api/v1/seller/wallet/payout-accounts");
    const accountId = accounts.body.data[0]?.id;
    expect(accountId, describeResponse(accounts)).toBeDefined();
    const payout = await seller("POST", "/api/v1/seller/wallet/payouts", { body: { amountMinor: 100_000_000, accountId }, idempotencyKey: `payout-${uniqueSuffix()}`, stepUpToken: await stepUpUser(store.seller) });
    expectClearError(payout, [403, 422], ["PAYOUT_ACCOUNT_NOT_VERIFIED", "SELLER_VERIFICATION_REQUIRED", "INSUFFICIENT_AVAILABLE_BALANCE"]);
    const payouts = await seller("GET", "/api/v1/seller/wallet/payouts");
    expect(payouts.status, describeResponse(payouts)).toBe(200);
    const schedule = await seller("PUT", "/api/v1/seller/wallet/payouts/schedule", { body: { mode: "weekly", weekday: 5, dayOfMonth: 1, keepMinimumBalanceMinor: 0, accountId } });
    expect(schedule.status, describeResponse(schedule)).toBe(200);
    expect(schedule.body.nextRunAt).not.toBeNull();
    expectClearError(await callApi("POST", "/api/v1/seller/wallet/payouts", { token, idempotent: false, body: { amountMinor: 100_000, accountId } }), 400, "IDEMPOTENCY_KEY_REQUIRED");
  });

  it("records the team trail and keeps paid analytics behind Pro", async () => {
    const audit = await seller("GET", "/api/v1/seller/audit-log");
    expect(audit.status, describeResponse(audit)).toBe(200);
    const actions = audit.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["settings.updated", "storefront.updated", "payout_account.added", "payout_schedule.updated"]));
    const overview = await seller("GET", "/api/v1/seller/analytics/overview");
    expect(overview.status, describeResponse(overview)).toBe(200);
    expect(overview.body.ordersCount).toBeGreaterThanOrEqual(1);
    expectClearError(await seller("GET", "/api/v1/seller/analytics/breakdowns"), 402, "PLAN_FEATURE_REQUIRED");
    expectClearError(await callApi("GET", "/api/v1/seller/wallet/balances", { token: buyer.accessToken }), 403, "NOT_STORE_MEMBER");
    expectLedgerBalancedSince(20);
  });
});
