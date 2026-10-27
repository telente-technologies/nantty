import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Boost, BoostPaymentOption } from "../types/boost.type";
import type { Money } from "../types/money.type";
import {
  AD_STATUS_FILTERS, adStatusAppearance, audienceIssue, budgetFloorIssue, buildBudgetChangeRequest, createIdempotencyKeyHolder, dailyBudgetForDraft, describeCreditLotExpiry, describePaymentOption, draftFromBoost,
  emptyAdDraft, estimateRequestFromDraft, firstSelectablePaymentMethod, parseMajorAmountToMinor, scaleReportSeries, startAtFromDate, statusesForAdFilter,
} from "./adsHub.util";

const money = (amountMinor: number, currency: Money["currency"] = "GHS"): Money => ({ amountMinor, currency });
const format = (value: Money) => `${value.currency} ${value.amountMinor}`;
const baseBoost: Boost = {
  id: "b1", postId: "", destinationType: "store", targetId: "s1", status: "active", goal: "store_visits", totalBudget: money(30_000), spent: money(5_000), startsAt: null, endsAt: null,
  results: { impressions: 10, reach: 8, profileVisits: 0, storeVisits: 3, messages: 0 }, rejectionReason: null, budgetType: "daily", dailyBudget: money(10_000), durationDays: 3,
};

describe("ads hub status filters", () => {
  it("maps each chip to the server status list and covers every status once", () => {
    assert.deepEqual(statusesForAdFilter("all"), []);
    assert.deepEqual(statusesForAdFilter("inReview"), ["in_review", "pending_payment"]);
    assert.deepEqual(statusesForAdFilter("completed"), ["completed", "cancelled"]);
    const covered = AD_STATUS_FILTERS.flatMap((filter) => filter.statuses);
    assert.equal(new Set(covered).size, covered.length);
    assert.equal(covered.length, 7);
  });

  it("labels statuses honestly", () => {
    assert.equal(adStatusAppearance("rejected").tone, "error");
    assert.equal(adStatusAppearance("cancelled").label, "Stopped");
    assert.equal(adStatusAppearance("paused").label, "Paused");
  });
});

describe("payment option states", () => {
  const context = { total: money(20_000), adFundsSpendable: money(10_000), earningsAvailable: money(50_000), freeBoostMaxTotal: money(15_000) };
  const option = (method: BoostPaymentOption["method"], available = true, reason: string | null = null): BoostPaymentOption => ({ method, available, reasonCode: available ? null : "X", reason });

  it("shows the server's reason for an unavailable option and never makes it selectable", () => {
    const state = describePaymentOption(option("balance", false, "Pay from your earnings on nantty.com"), context, format);
    assert.equal(state.selectable, false);
    assert.equal(state.note, "Pay from your earnings on nantty.com");
  });

  it("blocks ad credit and the free boost when the quote is above what they cover", () => {
    assert.equal(describePaymentOption(option("ad_balance"), context, format).selectable, false);
    assert.equal(describePaymentOption(option("free"), context, format).selectable, false);
    assert.equal(describePaymentOption(option("balance"), context, format).selectable, true);
    assert.equal(describePaymentOption(option("ad_balance"), { ...context, total: money(10_000) }, format).selectable, true);
  });

  it("never compares money in different currencies as covering", () => {
    assert.equal(describePaymentOption(option("ad_balance"), { ...context, total: money(100, "NGN") }, format).selectable, false);
  });

  it("falls back to the first selectable method when the choice becomes unavailable", () => {
    const states = [describePaymentOption(option("ad_balance"), context, format), describePaymentOption(option("card"), context, format)];
    assert.equal(firstSelectablePaymentMethod(states, "ad_balance"), "card");
    assert.equal(firstSelectablePaymentMethod([], null), null);
  });
});

describe("idempotency key holder", () => {
  it("reuses one key for the same body so a double tap charges once, and makes a new key when the body changes", () => {
    let counter = 0;
    const holder = createIdempotencyKeyHolder(() => `key-${++counter}`);
    const first = holder.keyFor({ extraDays: 2, paymentMethod: "card" });
    assert.equal(holder.keyFor({ extraDays: 2, paymentMethod: "card" }), first);
    assert.notEqual(holder.keyFor({ extraDays: 3, paymentMethod: "card" }), first);
    holder.reset();
    assert.equal(holder.keyFor({ extraDays: 3, paymentMethod: "card" }), "key-3");
  });
});

describe("report series scaling", () => {
  it("scales bars against the busiest day and survives empty or all-zero series", () => {
    const series = [
      { date: "2026-10-01", impressions: 50, reach: 1, clicks: 0, results: 0, spend: money(0) },
      { date: "2026-10-02", impressions: 100, reach: 1, clicks: 0, results: 0, spend: money(0) },
    ];
    assert.deepEqual(scaleReportSeries(series, "impressions").map((bar) => bar.fraction), [0.5, 1]);
    assert.deepEqual(scaleReportSeries(series, "clicks").map((bar) => bar.fraction), [0, 0]);
    assert.deepEqual(scaleReportSeries([], "impressions"), []);
  });
});

describe("drafts and requests", () => {
  it("derives the daily amount from a total budget, rounding up", () => {
    const draft = { ...emptyAdDraft({ type: "profile", targetId: "u1" }), budgetType: "total" as const, totalBudget: money(10_000), durationDays: 3 };
    assert.deepEqual(dailyBudgetForDraft(draft), money(3_334));
    const request = estimateRequestFromDraft(draft);
    assert.equal(request?.budgetType, "total");
    assert.deepEqual(request?.totalBudget, money(10_000));
    assert.equal(request?.postId, undefined);
  });

  it("refuses to build a request without a destination, with a bad audience, or zero budget", () => {
    assert.equal(estimateRequestFromDraft({ ...emptyAdDraft(null), dailyBudget: money(1_000) }), null);
    const custom = { mode: "custom" as const, countryCode: "ng", states: [], ageMin: 30, ageMax: 20 };
    assert.ok(audienceIssue(custom));
    assert.equal(estimateRequestFromDraft({ ...emptyAdDraft({ type: "post", targetId: "p1" }), dailyBudget: money(1_000), audience: custom }), null);
    assert.equal(estimateRequestFromDraft({ ...emptyAdDraft({ type: "post", targetId: "p1" }), dailyBudget: money(0) }), null);
  });

  it("checks the server floor for daily and total budgets", () => {
    const draft = { ...emptyAdDraft({ type: "post", targetId: "p1" }), dailyBudget: money(500), durationDays: 4 };
    assert.ok(budgetFloorIssue(draft, money(1_000), format));
    assert.equal(budgetFloorIssue({ ...draft, budgetType: "total", totalBudget: money(4_000) }, money(1_000), format), null);
    assert.ok(budgetFloorIssue({ ...draft, budgetType: "total", totalBudget: money(3_999) }, money(1_000), format));
  });

  it("ignores a past or invalid start date", () => {
    const now = new Date("2026-10-17T12:00:00");
    assert.equal(startAtFromDate("2026-10-17", now), undefined);
    assert.equal(startAtFromDate("not-a-date", now), undefined);
    assert.ok(startAtFromDate("2026-10-20", now));
  });

  it("prefills duplicate and resubmit drafts from an existing ad", () => {
    const draft = draftFromBoost(baseBoost);
    assert.deepEqual(draft.destination, { type: "store", targetId: "s1" });
    assert.deepEqual(draft.dailyBudget, money(10_000));
    assert.equal(draft.startDate, null);
  });

  it("parses typed amounts strictly", () => {
    assert.equal(parseMajorAmountToMinor("1,500.5"), 150_050);
    assert.equal(parseMajorAmountToMinor("-5"), null);
    assert.equal(parseMajorAmountToMinor("1.234"), null);
    assert.equal(parseMajorAmountToMinor(""), null);
  });
});

describe("budget change requests", () => {
  it("asks only for what changes and never lowers a daily budget", () => {
    assert.equal(buildBudgetChangeRequest(baseBoost, 0, 10_000), null);
    assert.equal(buildBudgetChangeRequest(baseBoost, 2, 5_000), null);
    assert.deepEqual(buildBudgetChangeRequest(baseBoost, 2, 10_000), { extraDays: 2 });
    assert.deepEqual(buildBudgetChangeRequest(baseBoost, 0, 15_000), { extraDays: 0, dailyBudget: money(15_000) });
  });

  it("adds to a total budget", () => {
    const totalBoost = { ...baseBoost, budgetType: "total" as const };
    assert.equal(buildBudgetChangeRequest(totalBoost, 0, null), null);
    assert.deepEqual(buildBudgetChangeRequest(totalBoost, 0, 2_000), { extraDays: 0, additionalBudget: money(2_000) });
  });
});

describe("credit lot expiry", () => {
  it("says when credit expires or that it doesn't", () => {
    assert.equal(describeCreditLotExpiry({ remaining: money(500), expiresAt: "2026-11-01T00:00:00Z" }, format, () => "Nov 1, 2026"), "GHS 500 expires on Nov 1, 2026");
    assert.equal(describeCreditLotExpiry({ remaining: money(500), expiresAt: null }, format, () => null), "GHS 500 · Doesn't expire");
  });
});
