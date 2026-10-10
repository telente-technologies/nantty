import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, stepUpStaff, type StaffActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { createStoreWithProduct, psql, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughFakePaystack, readFakePaystackState } from "../src/fakePaystack.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";

const moneyUrl = process.env["SMOKE_MONEY_URL"] ?? "http://127.0.0.1:8103";
const internalToken = process.env["SMOKE_MONEY_INTERNAL_TOKEN"] ?? "local-only-money-internal-api-token-0123456789";

function subscription(id: string): Record<string, string> {
  const [status, cancelAtPeriodEnd, lastError, dunningAttempts] = psql(`select status, cancel_at_period_end, coalesce(last_error, '-'), dunning_attempts from subscriptions.subscriptions where id = '${id}'`)[0] ?? [];
  return { status: status ?? "", cancelAtPeriodEnd: cancelAtPeriodEnd ?? "", lastError: lastError ?? "", dunningAttempts: dunningAttempts ?? "" };
}

async function sellerPlanOf(accountId: string): Promise<string> {
  const response = await callApi("GET", `/api/v1/internal/entitlements/${accountId}`, { baseUrl: moneyUrl, headers: { "x-internal-token": internalToken } });
  expect(response.status, describeResponse(response)).toBe(200);
  return response.body.sellerPlan;
}

function makeDueNow(id: string): void {
  psql(`update subscriptions.subscriptions set trial_ends_at = case when trial_ends_at is null then null else now() - interval '1 minute' end, current_period_ends_at = case when current_period_ends_at is null then null else now() - interval '1 minute' end, next_charge_at = now() - interval '1 minute' where id = '${id}'`);
}

describe("subscriptions and trials when people cancel early or their card fails", () => {
  let staff: StaffActor;
  let original: { value: unknown; version: number } | undefined;

  beforeAll(async () => {
    staff = await createSuperadmin();
    const current = await callApi("GET", "/api/v1/admin/config/trial-rules", { token: staff.accessToken });
    if (current.status === 200) original = { value: current.body.value, version: current.body.version };
    const base = (original?.value as Record<string, unknown> | undefined) ?? { trialLength: "7d", yearlyDiscountPercent: 20, requiresVerifiedEmail: true, onePerPerson: true, onePerCard: true, onePerDevice: true, maximumRiskScore: 50, minimumCompletedOrders: 0 };
    const relaxed = await callApi("PUT", "/api/v1/admin/config/trial-rules", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: { ...base, minimumAccountAgeDays: 0, onePerCard: false, minimumCompletedOrders: 0 }, expectedVersion: original?.version ?? 0, reason: "API smoke run needs new accounts to try a trial" } });
    expect([200, 201], describeResponse(relaxed)).toContain(relaxed.status);
  });

  afterAll(async () => {
    if (original === undefined) return;
    const latest = await callApi("GET", "/api/v1/admin/config/trial-rules", { token: staff.accessToken });
    await callApi("PUT", "/api/v1/admin/config/trial-rules", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: original.value, expectedVersion: latest.body.version, reason: "Restore after API smoke run" } });
  });

  it("ends a trial cancelled during the trial without charging, and refuses a second trial", { timeout: 180_000 }, async () => {
    const store: SmokeStore = await createStoreWithProduct("edgetrial", 500_000);
    const web = { "x-client-platform": "web", "x-client-region": "NG", "x-device-id": `smoke-trial-${randomUUID()}` };
    const refundsBefore = ((await readFakePaystackState()).refunds ?? []).length;
    const started = await callApi("POST", "/api/v1/seller/subscription/trial/checkout", { token: store.seller.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_pro_monthly" } });
    expect(started.status, describeResponse(started)).toBe(201);
    expect(started.body.trial).toBe(true);
    await payCheckoutThroughFakePaystack(started.body.reference);
    const subscriptionId = (await waitFor(async () => psql(`select id from subscriptions.subscriptions where profile_id = '${store.businessProfileId}' and status = 'trialing'`)[0]?.[0], 30_000, 1000))!;
    expect(subscriptionId, "the card check starts the trial").toBeDefined();
    expect(await waitFor(async () => (((await readFakePaystackState()).refunds ?? []).length > refundsBefore ? true : undefined), 20_000, 500), "the card check is refunded at once").toBe(true);
    expect(await sellerPlanOf(store.seller.accountId)).toBe("pro");
    const cancelled = await callApi("POST", `/api/v1/subscriptions/${subscriptionId}/cancel`, { token: store.seller.accessToken, body: {} });
    expect(cancelled.status, describeResponse(cancelled)).toBe(200);
    expect(cancelled.body.cancelAtPeriodEnd).toBe(true);
    expect(subscription(subscriptionId).status, "keeps the trial until it ends").toBe("trialing");
    makeDueNow(subscriptionId);
    const ended = await waitFor(async () => (subscription(subscriptionId).status === "canceled" ? true : undefined), 150_000, 3000);
    expect(ended, `trial never ended: ${JSON.stringify(subscription(subscriptionId))}`).toBe(true);
    expect(psql(`select count(*) from subscriptions.subscription_periods where subscription_id = '${subscriptionId}' and status = 'paid' and amount_due_minor > 0`)[0]?.[0], "no charge after a cancelled trial").toBe("0");
    expect(await sellerPlanOf(store.seller.accountId)).toBe("free");
    const again = await callApi("POST", "/api/v1/seller/subscription/trial/checkout", { token: store.seller.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_pro_monthly" } });
    expectClearError(again, [409, 422], "TRIAL_NOT_AVAILABLE");
  });

  it("puts a plan past due when the card fails at renewal, keeps a clear reason, and recovers when the buyer pays", { timeout: 200_000 }, async () => {
    const store: SmokeStore = await createStoreWithProduct("edgerenew", 500_000);
    const web = { "x-client-platform": "web", "x-client-region": "NG", "x-device-id": `smoke-renew-${randomUUID()}` };
    const started = await callApi("POST", "/api/v1/seller/subscription/checkout", { token: store.seller.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_pro_monthly" } });
    expect(started.status, describeResponse(started)).toBe(201);
    await payCheckoutThroughFakePaystack(started.body.reference, 0, "decline");
    const subscriptionId: string = started.body.subscriptionId;
    expect(await waitFor(async () => (subscription(subscriptionId).status === "active" ? true : undefined), 30_000, 1000), "first payment activates the plan").toBe(true);
    makeDueNow(subscriptionId);
    const failed = await waitFor(async () => (["past_due", "grace"].includes(subscription(subscriptionId).status ?? "") ? subscription(subscriptionId) : undefined), 150_000, 3000);
    expect(failed, `renewal never failed: ${JSON.stringify(subscription(subscriptionId))}`).toBeDefined();
    expect(failed!.lastError, "the reason is kept for the owner").not.toBe("-");
    expect(Number(failed!.dunningAttempts)).toBeGreaterThanOrEqual(1);
    expect(await sellerPlanOf(store.seller.accountId), "past due keeps the plan while retrying").toBe("pro");
    const periods = await callApi("GET", `/api/v1/subscriptions/${subscriptionId}/periods`, { token: store.seller.accessToken });
    expect(periods.status, describeResponse(periods)).toBe(200);
    expect(JSON.stringify(periods.body), "the failed renewal is listed").toMatch(/failed/);
    const payNow = await callApi("POST", `/api/v1/subscriptions/${subscriptionId}/pay-now`, { token: store.seller.accessToken, headers: web, body: {} });
    expect([200, 201], describeResponse(payNow)).toContain(payNow.status);
    const reference: string | undefined = payNow.body.reference ?? payNow.body.payment?.reference;
    if (reference !== undefined) {
      await payCheckoutThroughFakePaystack(reference);
      const recovered = await waitFor(async () => (subscription(subscriptionId).status === "active" ? true : undefined), 30_000, 1000);
      expect(recovered, `paying the failed renewal restores the plan: ${JSON.stringify(subscription(subscriptionId))}`).toBe(true);
    }
    expectLedgerBalancedSince(20);
  });
});
