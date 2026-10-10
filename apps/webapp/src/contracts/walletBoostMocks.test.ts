import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { demoFanAccount, me, mockSession } from "@/mocks/fixtures.mock";
import type { Boost, BoostOptions, CreatedBoost } from "@/types/boost.type";
import type { WalletSummary } from "@/types";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown) => dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });
const LINE_KEYS = ["available", "pending", "locked", "earningsPayable", "adCredit", "coins", "debts"];

const boostRequest = async (paymentMethod: string, budgetIndex = 0, durationDays = 1) => {
  const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
  return { postId: "post_9", goal: "views", audience: { mode: "automatic" }, dailyBudget: options.suggestedDailyBudgets[budgetIndex], durationDays, paymentMethod };
};

describe("wallet mock", () => {
  it("lists every ledger line once, in order, with coins as a coin count", async () => {
    const summary = await call<WalletSummary>("GET", "/api/v1/wallets/me");
    assert.deepEqual(summary.lines?.map((line) => line.key), LINE_KEYS);
    const coins = summary.lines?.find((line) => line.key === "coins");
    assert.equal(coins?.amount.currency, "COIN");
    assert.equal(coins?.amount.amountMinor, (summary.coins?.spendable ?? 0) + (summary.coins?.earned ?? 0));
    assert.deepEqual(summary.lines?.find((line) => line.key === "pending")?.amount, summary.pending);
    assert.equal(summary.verification?.withdrawalsUnlocked, true);
    assert.equal(summary.verification?.message, null);
  });

  it("asks an unverified user to verify, keeps their money and refuses the withdrawal", async () => {
    mockSession.signedInUserId = demoFanAccount.id;
    try {
      const summary = await call<WalletSummary>("GET", "/api/v1/wallets/me");
      assert.equal(summary.verification?.level, 0);
      assert.equal(summary.verification?.nextStep, "payout_setup");
      assert.match(summary.verification?.message ?? "", /^Verify to withdraw/);
      const refused = await failureOf(call("POST", "/api/v1/wallets/me/withdrawals", { payoutAccountId: "pa_1", amount: { amountMinor: 100, currency: summary.available.currency } }));
      assert.equal(refused?.code, "SELLER_VERIFICATION_REQUIRED");
      assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await boostRequest("balance"))))?.code, "VERIFICATION_REQUIRED");
    } finally {
      mockSession.signedInUserId = me.id;
    }
  });
});

describe("boost payment mocks", () => {
  it("gives non-Premium users no free boost", async () => {
    mockSession.signedInUserId = demoFanAccount.id;
    try {
      const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
      assert.ok(!options.paymentMethods?.includes("free"));
      assert.equal(options.freeBoost?.eligible, false);
      assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await boostRequest("free"))))?.code, "FREE_BOOST_NOT_AVAILABLE");
    } finally {
      mockSession.signedInUserId = me.id;
    }
  });

  it("lets Premium use one free boost within the cap, then refuses a second", async () => {
    const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
    assert.deepEqual(options.paymentMethods, ["card", "balance", "free"]);
    assert.equal(options.freeBoost?.remainingThisMonth, 1);
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await boostRequest("free", 3, 14))))?.code, "FREE_BOOST_TOO_LARGE");
    const created = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await boostRequest("free"));
    assert.equal(created.checkoutUrl, null);
    assert.equal((await call<Boost>("GET", `/api/v1/ads/boosts/${created.boost.id}`)).paymentMethod, "free");
    assert.equal((await call<BoostOptions>("GET", "/api/v1/ads/boosts/options")).freeBoost?.remainingThisMonth, 0);
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", await boostRequest("free"))))?.code, "FREE_BOOST_USED");
  });

  it("returns a Paystack checkout for card and refuses balance payments above the available balance", async () => {
    const card = await call<CreatedBoost>("POST", "/api/v1/ads/boosts", await boostRequest("card"));
    assert.match(card.checkoutUrl ?? "", /^https:\/\/checkout\.paystack\.com\//);
    assert.equal(card.boost.paymentMethod, "card");
    const options = await call<BoostOptions>("GET", "/api/v1/ads/boosts/options");
    const huge = { postId: "post_9", goal: "views", audience: { mode: "automatic" }, dailyBudget: { ...options.suggestedDailyBudgets[0]!, amountMinor: 10_000_000_000 }, durationDays: 14, paymentMethod: "balance" };
    assert.equal((await failureOf(call("POST", "/api/v1/ads/boosts", huge)))?.code, "INSUFFICIENT_FUNDS");
  });
});
