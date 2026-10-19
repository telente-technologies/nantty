import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedRejectedMockBoost } from "@/mocks/boosts.mock";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { demoFanAccount, me, mockSession } from "@/mocks/fixtures.mock";
import type { AdBalance } from "@/types/adsHub.type";
import type { BoostOptions, CreateBoostRequest, CreatedBoost } from "@/types/boost.type";

import { validateAgainstContract } from "./contractSchema.util";
import { adsHubBoostSchema, adsHubBudgetChangeSchema, adsHubBudgetQuoteSchema, adsHubReportSchema, adsHubWithdrawalQuoteSchema } from "./webapp.contract";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown, query = "") => dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });

const profileAd = async (paymentMethod: CreateBoostRequest["paymentMethod"], days = 3): Promise<CreateBoostRequest> => {
  const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
  return { destinationType: "profile", targetId: me.id, goal: "profile_visits", audience: { mode: "automatic" }, budgetType: "daily", dailyBudget: options.minimumDailyBudget, durationDays: days, paymentMethod };
};

describe("ads hub mocks", () => {
  it("creates an ad paid from ad credit and balance and lists it under Active, not Paused", async () => {
    mockSession.signedInUserId = me.id;
    const created = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await profileAd("ad_balance"));
    assert.deepEqual(validateAgainstContract(adsHubBoostSchema, created.boost), []);
    assert.equal(created.checkoutUrl, null);
    const active = await call<{ data: { id: string }[] }>("GET", "/api/v1/ads/boosts", undefined, "status=active");
    assert.ok(active.data.some((boost) => boost.id === created.boost.id));
    const paused = await call<{ data: { id: string }[] }>("GET", "/api/v1/ads/boosts", undefined, "status=paused");
    assert.ok(!paused.data.some((boost) => boost.id === created.boost.id));
    assert.equal((await failureOf(call("GET", "/api/v1/ads/boosts", undefined, "status=bogus")))?.code, "VALIDATION_FAILED");
  });

  it("pauses, refuses a second pause, resumes, stops, and then refuses resume and budget changes", async () => {
    mockSession.signedInUserId = me.id;
    const { boost } = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await profileAd("ad_balance"));
    const base = `/api/v1/ads/boosts/${boost.id}`;
    assert.equal((await call<{ status: string; actions: { resume: boolean } }>("POST", `${base}/pause`, {})).actions.resume, true);
    assert.equal((await failureOf(call("POST", `${base}/pause`, {})))?.code, "BOOST_STATUS_CHANGE_NOT_ALLOWED");
    assert.equal((await call<{ status: string }>("POST", `${base}/resume`, {})).status, "active");
    assert.equal((await call<{ status: string }>("POST", `${base}/cancel`, {})).status, "cancelled");
    assert.equal((await failureOf(call("POST", `${base}/resume`, {})))?.code, "BOOST_STATUS_CHANGE_NOT_ALLOWED");
    assert.equal((await failureOf(call("POST", `${base}/budget/quote`, { extraDays: 2 })))?.code, "BOOST_BUDGET_CHANGE_NOT_ALLOWED");
  });

  it("lets only the owner manage an ad", async () => {
    mockSession.signedInUserId = me.id;
    const { boost } = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await profileAd("ad_balance"));
    mockSession.signedInUserId = demoFanAccount.id;
    try {
      assert.equal((await failureOf(call("POST", `/api/v1/ads/boosts/${boost.id}/pause`, {})))?.status, 403);
      assert.equal((await failureOf(call("POST", `/api/v1/ads/boosts/${boost.id}/budget`, { extraDays: 1, paymentMethod: "ad_balance" })))?.status, 403);
      assert.equal((await failureOf(call("GET", `/api/v1/ads/boosts/${boost.id}`)))?.status, 404);
    } finally {
      mockSession.signedInUserId = me.id;
    }
  });

  it("quotes and applies a budget change, and refuses lowering the daily budget or earnings payment", async () => {
    mockSession.signedInUserId = me.id;
    const { boost } = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await profileAd("ad_balance", 1));
    const base = `/api/v1/ads/boosts/${boost.id}`;
    const quote = await call("POST", `${base}/budget/quote`, { extraDays: 1 });
    assert.deepEqual(validateAgainstContract(adsHubBudgetQuoteSchema, quote), []);
    const lowered = { extraDays: 0, dailyBudget: { amountMinor: 1, currency: boost.totalBudget.currency } };
    assert.equal((await failureOf(call("POST", `${base}/budget/quote`, lowered)))?.code, "VALIDATION_FAILED");
    assert.equal((await failureOf(call("POST", `${base}/budget`, { extraDays: 1, paymentMethod: "balance" })))?.code, "VALIDATION_FAILED");
    const changed = await call("POST", `${base}/budget`, { extraDays: 1, paymentMethod: "card" });
    assert.deepEqual(validateAgainstContract(adsHubBudgetChangeSchema, changed), []);
    assert.equal((changed as { change: { status: string } }).change.status, "pending_payment");
    assert.deepEqual(validateAgainstContract(adsHubReportSchema, await call("GET", `${base}/report`)), []);
  });

  it("refuses ad balance payment above what you can spend", async () => {
    mockSession.signedInUserId = me.id;
    const request = { ...(await profileAd("ad_balance")), dailyBudget: { amountMinor: 10_000_000_000, currency: (await profileAd("card")).dailyBudget.currency }, durationDays: 30 };
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", request)))?.code, "INSUFFICIENT_AD_BALANCE");
  });

  it("marks a rejected ad for resubmission and blocks its budget change", async () => {
    mockSession.signedInUserId = me.id;
    const id = seedRejectedMockBoost(await profileAd("card"), "Image text is too small to read.");
    const rejected = await call<{ status: string; rejectionReason: string; actions: { resubmit: boolean; changeBudget: boolean; pause: boolean } }>("GET", `/api/v1/ads/boosts/${id}`);
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReason, "Image text is too small to read.");
    assert.deepEqual([rejected.actions.resubmit, rejected.actions.changeBudget, rejected.actions.pause], [true, false, false]);
    assert.equal((await failureOf(call("POST", `/api/v1/ads/boosts/${id}/budget`, { extraDays: 1, paymentMethod: "ad_balance" })))?.code, "BOOST_BUDGET_CHANGE_NOT_ALLOWED");
  });

  it("quotes a withdrawal with fee and net, and refuses more than is withdrawable", async () => {
    mockSession.signedInUserId = me.id;
    const balance = await call<AdBalance>("GET", "/api/v1/ads/boosts/balance");
    assert.notEqual(balance.balance, balance.credit);
    const above = { amount: { amountMinor: balance.withdrawable.amountMinor + balance.credit.amountMinor + 1, currency: balance.withdrawable.currency } };
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", above)))?.code, "WITHDRAWAL_ABOVE_AVAILABLE");
    if (balance.withdrawable.amountMinor > 0) {
      const quote = await call("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", { amount: balance.withdrawable });
      assert.deepEqual(validateAgainstContract(adsHubWithdrawalQuoteSchema, quote), []);
    }
  });
});
