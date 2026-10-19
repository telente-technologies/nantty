import type { Boost, BoostOptions } from "@/types/boost.type";
import { authOnlyRouteSignInPhrases } from "@/config/guestAccess.config";

import {
  AD_STATUS_FILTERS, adBalanceTransactionReason, buildBudgetChangeInput, adCreditLotExpiryLabel, boostAvailableActions, boostKeyResult, boostPaymentChoices, budgetBelowMinimum,
  buildBoostEstimateRequest, createAdDraftFromBoost, createStableIdempotencyKeys, dailyBudgetFromTotal, EMPTY_CREATE_AD_DRAFT, goalsForDestination,
  parseMoneyInput, reportBars, resolvePaymentMethod,
} from "../adsHub.util";

const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" as const });

const options = (overrides: Partial<BoostOptions> = {}): BoostOptions => ({
  minimumDailyBudget: ngn(100_000), suggestedDailyBudgets: [ngn(100_000), ngn(300_000)], durationDayOptions: [1, 3, 7, 14], interests: [],
  paymentOptions: [
    { method: "card", available: true, reasonCode: null, reason: null },
    { method: "ad_balance", available: true, reasonCode: null, reason: null },
    { method: "balance", available: false, reasonCode: "NOT_AVAILABLE_IN_APP", reason: "Pay from your earnings on zudomart.com" },
    { method: "free", available: true, reasonCode: null, reason: null },
  ],
  adBalance: { accountId: "a1", balance: ngn(200_000), credit: ngn(100_000), committed: ngn(0), spendable: ngn(300_000) },
  freeBoost: { premium: true, eligible: true, remainingThisMonth: 1, maxTotal: ngn(100_000), resetsAt: null },
  ...overrides,
});

const boost = (overrides: Partial<Boost> = {}): Boost => ({
  id: "b1", postId: "", destinationType: "store", targetId: "store-1", status: "active", goal: "store_visits", totalBudget: ngn(900_000), spent: ngn(300_000),
  startsAt: null, endsAt: null, rejectionReason: null, budgetType: "daily", dailyBudget: ngn(300_000), durationDays: 3,
  results: { impressions: 1000, reach: 800, profileVisits: 0, storeVisits: 12, messages: 0 }, ...overrides,
});

describe("status filters and chips", () => {
  it("groups statuses the way the hub filters show them", () => {
    expect(Object.fromEntries(AD_STATUS_FILTERS.map((filter) => [filter.key, filter.statuses]))).toEqual({
      all: [], in_review: ["in_review", "pending_payment"], active: ["active"], paused: ["paused"], completed: ["completed", "cancelled"], rejected: ["rejected"],
    });
  });

  it("uses server actions and falls back to the status machine", () => {
    expect(boostAvailableActions(boost({ status: "paused" }))).toMatchObject({ pause: false, resume: true, stop: true, changeBudget: true, resubmit: false });
    expect(boostAvailableActions(boost({ status: "rejected" }))).toMatchObject({ pause: false, resume: false, stop: false, changeBudget: false, resubmit: true });
    expect(boostAvailableActions(boost({ status: "completed" }))).toMatchObject({ stop: false, changeBudget: false });
    const serverSaysNo = { pause: false, resume: false, stop: false, changeBudget: false, resubmit: false };
    expect(boostAvailableActions(boost({ status: "active", actions: serverSaysNo }))).toEqual(serverSaysNo);
  });

  it("derives the key result from the goal when the server omits it", () => {
    expect(boostKeyResult(boost())).toEqual({ label: "Store visits", value: 12 });
    expect(boostKeyResult(boost({ goal: "product_visits", results: { impressions: 1, reach: 1, profileVisits: 0, messages: 0 } }))).toEqual({ label: "Product views", value: 0 });
  });
});

describe("payment options", () => {
  it("shows unavailable methods with the server's reason", () => {
    const earnings = boostPaymentChoices(options(), ngn(100_000)).find((choice) => choice.method === "balance");
    expect(earnings).toMatchObject({ selectable: false, note: "Pay from your earnings on zudomart.com" });
  });

  it("blocks ad credit & balance when spendable is below the quote", () => {
    const choices = boostPaymentChoices(options(), ngn(400_000));
    expect(choices.find((choice) => choice.method === "ad_balance")).toMatchObject({ selectable: false, label: "Ad credit & balance" });
    expect(choices.find((choice) => choice.method === "free")).toMatchObject({ selectable: false });
    expect(resolvePaymentMethod(choices, "ad_balance")).toBe("card");
  });

  it("allows the free boost only within its cap and when unused", () => {
    expect(boostPaymentChoices(options(), ngn(100_000)).find((choice) => choice.method === "free")?.selectable).toBe(true);
    const used = options({ freeBoost: { premium: true, eligible: false, remainingThisMonth: 0, maxTotal: ngn(100_000), resetsAt: null } });
    expect(boostPaymentChoices(used, ngn(100_000)).find((choice) => choice.method === "free")?.selectable).toBe(false);
  });

  it("falls back to legacy paymentMethods when the server sends no paymentOptions", () => {
    const legacy = boostPaymentChoices(options({ paymentOptions: undefined, paymentMethods: ["card"] }), ngn(100_000));
    expect(legacy.map((choice) => choice.method)).toEqual(["card"]);
  });

  it("returns null when nothing can be paid", () => {
    expect(resolvePaymentMethod([{ method: "card", label: "Card", selectable: false, note: null }], null)).toBeNull();
  });
});

describe("idempotency keys", () => {
  it("reuses one key for the same body so a double tap charges once, and a new key after a change or reset", () => {
    let counter = 0;
    const keys = createStableIdempotencyKeys(() => `key-${++counter}`);
    const body = { extraDays: 3, paymentMethod: "card" };
    expect(keys.keyFor(body)).toBe("key-1");
    expect(keys.keyFor({ ...body })).toBe("key-1");
    expect(keys.keyFor({ ...body, extraDays: 7 })).toBe("key-2");
    keys.reset();
    expect(keys.keyFor({ ...body, extraDays: 7 })).toBe("key-3");
  });
});

describe("report bars", () => {
  it("scales every day against the busiest day", () => {
    const point = (date: string, impressions: number, spendMinor: number) => ({ date, impressions, reach: 0, clicks: 0, results: 0, spend: ngn(spendMinor) });
    const series = [point("2026-10-01", 50, 0), point("2026-10-02", 200, 400), point("2026-10-03", 0, 100)];
    expect(reportBars(series, "impressions").map((bar) => bar.ratio)).toEqual([0.25, 1, 0]);
    expect(reportBars(series, "spend").map((bar) => bar.ratio)).toEqual([0, 1, 0.25]);
    expect(reportBars([point("2026-10-01", 0, 0)], "clicks")[0]!.ratio).toBe(0);
  });
});

describe("create ad request bodies", () => {
  const base = { ...EMPTY_CREATE_AD_DRAFT, goal: "views" as const, dailyBudget: ngn(100_000), durationDays: 3 };

  it("builds each destination type", () => {
    expect(buildBoostEstimateRequest({ ...base, destination: { type: "post", targetId: "p1" } })).toMatchObject({ postId: "p1", destinationType: "post", targetId: "p1", budgetType: "daily" });
    for (const type of ["profile", "store", "product"] as const) {
      const request = buildBoostEstimateRequest({ ...base, destination: { type, targetId: `${type}-1` } });
      expect(request).toMatchObject({ destinationType: type, targetId: `${type}-1` });
      expect(request).not.toHaveProperty("postId");
    }
  });

  it("sends total budgets with a derived daily amount and keeps the start date", () => {
    const request = buildBoostEstimateRequest({ ...base, destination: { type: "store", targetId: "s1" }, budgetType: "total", totalBudget: ngn(1_000_000), startAt: "2026-11-01T07:00:00.000Z" });
    expect(request).toMatchObject({ budgetType: "total", totalBudget: ngn(1_000_000), dailyBudget: ngn(333_334), startAt: "2026-11-01T07:00:00.000Z" });
    expect(dailyBudgetFromTotal(ngn(10), 3)).toEqual(ngn(4));
  });

  it("refuses incomplete drafts and flags budgets below the minimum", () => {
    expect(buildBoostEstimateRequest({ ...base, destination: null })).toBeNull();
    expect(buildBoostEstimateRequest({ ...base, destination: { type: "post", targetId: "p" }, budgetType: "total", totalBudget: null })).toBeNull();
    expect(budgetBelowMinimum({ ...base, dailyBudget: ngn(50_000) }, options())).toBe(true);
    expect(budgetBelowMinimum({ ...base, budgetType: "total", totalBudget: ngn(300_000) }, options())).toBe(false);
  });

  it("prefills a resubmission from a rejected boost", () => {
    const rejected = boost({ status: "rejected", rejectionReason: "Misleading claim", audience: { mode: "custom", countryCode: "NG", states: ["NG-LA"], interests: [], ageMin: 18, ageMax: 34, gender: "female", topicIds: ["t1"] } });
    const draft = createAdDraftFromBoost(rejected);
    expect(draft).toMatchObject({ destination: { type: "store", targetId: "store-1" }, goal: "store_visits", dailyBudget: ngn(300_000), durationDays: 3, startAt: null });
    expect(draft.audience).toMatchObject({ gender: "female", states: ["NG-LA"] });
  });

  it("parses typed amounts into minor units", () => {
    expect(parseMoneyInput("1,500.50", "NGN")).toEqual(ngn(150_050));
    expect(parseMoneyInput("abc", "NGN")).toBeNull();
    expect(parseMoneyInput("0", "NGN")).toBeNull();
  });

  it("uses server goals per destination with local labels", () => {
    expect(goalsForDestination("product", undefined).map((goal) => goal.id)).toEqual(["product_visits"]);
    expect(goalsForDestination("post", options({ goalsByDestination: { post: ["views"] } })).map((goal) => goal.label)).toEqual(["More views"]);
  });
});

describe("budget change input", () => {
  it("only sends what changes", () => {
    expect(buildBudgetChangeInput(boost(), 0, ngn(300_000), null)).toBeNull();
    expect(buildBudgetChangeInput(boost(), 3, ngn(300_000), null)).toEqual({ extraDays: 3 });
    expect(buildBudgetChangeInput(boost(), 0, ngn(600_000), null)).toEqual({ extraDays: 0, dailyBudget: ngn(600_000) });
    expect(buildBudgetChangeInput(boost({ budgetType: "total" }), 0, null, ngn(50_000))).toEqual({ extraDays: 0, additionalBudget: ngn(50_000) });
  });
});

describe("ad balance labels", () => {
  it("labels credit expiry and transaction reasons", () => {
    expect(adCreditLotExpiryLabel({ id: "l", source: "cashback", remaining: ngn(50_000), expiresAt: null, reason: null, createdAt: "" })).toMatch(/Doesn't expire$/);
    expect(adCreditLotExpiryLabel({ id: "l", source: "admin_issued", remaining: ngn(50_000), expiresAt: "2026-12-01T00:00:00Z", reason: null, createdAt: "" })).toMatch(/expires on Dec 1, 2026$/);
    expect(adBalanceTransactionReason("credit_expired")).toBe("Expired");
    expect(adBalanceTransactionReason("withdrawal")).toBe("Withdrawn to wallet");
  });
});

describe("guests", () => {
  it("sends guests to sign in for every Ads hub screen", () => {
    for (const route of ["AdsHub", "CreateAd", "AdBalance", "BoostStatus"]) expect(authOnlyRouteSignInPhrases[route]).toBeTruthy();
  });
});
