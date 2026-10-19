import { resolveMockApiRequest } from "@/mocks";
import { rejectMockBoostForTests } from "@/mocks/boosts.mock";
import { getSignedInMockUser } from "@/mocks/fixtures.mock";
import type {
  AdBalance, AdBalanceWithdrawalQuote, Boost, BoostBudgetChangeResult, BoostBudgetQuote, BoostOptions, BoostReport, CreatedBoost, CreateBoostRequest,
} from "@/types/boost.type";
import { buildBoostEstimateRequest, createAdDraftFromBoost, EMPTY_CREATE_AD_DRAFT } from "@/utils/adsHub.util";

const request = async (overrides: Partial<CreateBoostRequest>): Promise<CreateBoostRequest> => {
  const options = await resolveMockApiRequest<BoostOptions>("GET", "/api/v1/ads/boosts/options", undefined);
  return { goal: "views", audience: { mode: "automatic" }, budgetType: "daily", dailyBudget: options.suggestedDailyBudgets[0]!, durationDays: 3, paymentMethod: "card", ...overrides };
};

let keyCounter = 0;
const createBoost = async (overrides: Partial<CreateBoostRequest>) =>
  (await resolveMockApiRequest<CreatedBoost>("POST", "/api/v1/ads/boosts", await request(overrides), `ads-hub-key-${++keyCounter}`)).boost;

describe("ads hub mocks follow the contract", () => {
  it("lists payment options with reasons and the two-pot ad balance", async () => {
    const options = await resolveMockApiRequest<BoostOptions>("GET", "/api/v1/ads/boosts/options", undefined);
    expect(options.paymentOptions?.map((option) => option.method)).toEqual(["card", "ad_balance", "balance", "free"]);
    expect(options.paymentOptions?.find((option) => option.method === "balance")).toMatchObject({ available: false, reasonCode: "NOT_AVAILABLE_IN_APP" });
    expect(options.adBalance).toEqual(expect.objectContaining({ balance: expect.any(Object), credit: expect.any(Object), spendable: expect.any(Object) }));
    expect(options.goalsByDestination?.product).toEqual(["product_visits"]);
  });

  it("creates an ad for every destination type", async () => {
    const me = getSignedInMockUser();
    const post = await createBoost({ destinationType: "post", targetId: "post-1", postId: "post-1" });
    const profile = await createBoost({ destinationType: "profile", targetId: me.id, goal: "profile_visits" });
    const product = await createBoost({ destinationType: "product", targetId: "product-1", goal: "product_visits", paymentMethod: "ad_balance" });
    expect([post.destinationType, profile.destinationType, product.destinationType]).toEqual(["post", "profile", "product"]);
    expect(product).toMatchObject({ status: "in_review", paymentMethod: "ad_balance", actions: { changeBudget: true, pause: false } });
    if (me.storeId) expect((await createBoost({ destinationType: "store", targetId: me.storeId, goal: "store_visits" })).destinationType).toBe("store");
  });

  it("accepts a total budget and a scheduled start", async () => {
    const options = await resolveMockApiRequest<BoostOptions>("GET", "/api/v1/ads/boosts/options", undefined);
    const total = { amountMinor: options.minimumDailyBudget.amountMinor * 5, currency: options.minimumDailyBudget.currency };
    const body = buildBoostEstimateRequest({ ...EMPTY_CREATE_AD_DRAFT, destination: { type: "post", targetId: "post-9" }, goal: "views", budgetType: "total", totalBudget: total, durationDays: 5, startAt: "2026-11-01T07:00:00.000Z" })!;
    const estimate = await resolveMockApiRequest<{ totalCost: { amountMinor: number } }>("POST", "/api/v1/ads/boosts/estimate", body);
    expect(estimate.totalCost.amountMinor).toBe(total.amountMinor);
  });

  it("refuses ad credit & balance when it doesn't cover the ad", async () => {
    const options = await resolveMockApiRequest<BoostOptions>("GET", "/api/v1/ads/boosts/options", undefined);
    const huge = { amountMinor: options.adBalance!.spendable.amountMinor + options.minimumDailyBudget.amountMinor * 100, currency: options.minimumDailyBudget.currency };
    await expect(createBoost({ destinationType: "post", targetId: "post-2", postId: "post-2", dailyBudget: huge, durationDays: 1, paymentMethod: "ad_balance" })).rejects.toMatchObject({ code: "INSUFFICIENT_AD_BALANCE" });
  });

  it("filters the list by status", async () => {
    const active = await createBoost({ destinationType: "post", targetId: "post-3", postId: "post-3" });
    const page = await resolveMockApiRequest<{ data: Boost[]; nextCursor: string | null }>("GET", "/api/v1/ads/boosts?status=active", undefined);
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((boost) => boost.status === "active")).toBe(true);
    expect(page.data.some((boost) => boost.id === active.id)).toBe(true);
    const rejected = await resolveMockApiRequest<{ data: Boost[] }>("GET", "/api/v1/ads/boosts?status=rejected", undefined);
    expect(rejected.data.every((boost) => boost.status === "rejected")).toBe(true);
  });

  it("pauses, resumes and stops, and refuses invalid transitions", async () => {
    const boost = await createBoost({ destinationType: "post", targetId: "post-4", postId: "post-4" });
    await expect(resolveMockApiRequest("POST", `/api/v1/ads/boosts/${boost.id}/resume`, {}, "k-resume-early")).rejects.toMatchObject({ code: "BOOST_STATUS_CHANGE_NOT_ALLOWED" });
    expect((await resolveMockApiRequest<Boost>("POST", `/api/v1/ads/boosts/${boost.id}/pause`, {}, "k-pause")).status).toBe("paused");
    expect((await resolveMockApiRequest<Boost>("POST", `/api/v1/ads/boosts/${boost.id}/resume`, {}, "k-resume")).status).toBe("active");
    expect((await resolveMockApiRequest<Boost>("POST", `/api/v1/ads/boosts/${boost.id}/cancel`, {}, "k-stop")).status).toBe("cancelled");
    await expect(resolveMockApiRequest("POST", `/api/v1/ads/boosts/${boost.id}/resume`, {}, "k-resume-stopped")).rejects.toMatchObject({ code: "BOOST_STATUS_CHANGE_NOT_ALLOWED" });
    await expect(resolveMockApiRequest("POST", `/api/v1/ads/boosts/${boost.id}/budget/quote`, { extraDays: 3 })).rejects.toMatchObject({ code: "BOOST_BUDGET_CHANGE_NOT_ALLOWED" });
  });

  it("quotes and applies a budget change once per idempotency key", async () => {
    const boost = await createBoost({ destinationType: "post", targetId: "post-5", postId: "post-5" });
    const quote = await resolveMockApiRequest<BoostBudgetQuote>("POST", `/api/v1/ads/boosts/${boost.id}/budget/quote`, { extraDays: 3 });
    expect(quote.additionalCost.amountMinor).toBeGreaterThan(0);
    expect(quote.paymentOptions.filter((option) => option.available).map((option) => option.method)).toEqual(expect.arrayContaining(["card"]));
    const body = { extraDays: 3, paymentMethod: "card" as const };
    const first = await resolveMockApiRequest<BoostBudgetChangeResult>("POST", `/api/v1/ads/boosts/${boost.id}/budget`, body, "change-key-1");
    const replay = await resolveMockApiRequest<BoostBudgetChangeResult>("POST", `/api/v1/ads/boosts/${boost.id}/budget`, body, "change-key-1");
    expect(first.change.status).toBe("pending_payment");
    expect(first.checkoutUrl).toMatch(/^https:\/\//);
    expect(replay.boost.totalBudget).toEqual(first.boost.totalBudget);
    expect(first.boost.totalBudget.amountMinor).toBe(boost.totalBudget.amountMinor + quote.additionalCost.amountMinor);
    await expect(resolveMockApiRequest("POST", `/api/v1/ads/boosts/${boost.id}/budget`, { ...body, extraDays: 7 }, "change-key-1")).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    await expect(resolveMockApiRequest("POST", `/api/v1/ads/boosts/${boost.id}/budget`, { extraDays: 0, paymentMethod: "card" }, "change-key-2")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("reports daily results and prefills a resubmission after rejection", async () => {
    const boost = await createBoost({ destinationType: "post", targetId: "post-6", postId: "post-6", audience: { mode: "custom", countryCode: "NG", states: ["NG-LA"], interests: [], ageMin: 25, ageMax: 34, gender: "male", topicIds: ["t_1"] } });
    const report = await resolveMockApiRequest<BoostReport>("GET", `/api/v1/ads/boosts/${boost.id}/report`, undefined);
    expect(report.series.length).toBeGreaterThan(0);
    expect(report.totals.spend.currency).toBe(boost.spent.currency);
    rejectMockBoostForTests(boost.id, "The image makes a misleading claim.");
    const rejected = await resolveMockApiRequest<Boost>("GET", `/api/v1/ads/boosts/${boost.id}`, undefined);
    expect(rejected).toMatchObject({ status: "rejected", rejectionReason: "The image makes a misleading claim.", actions: { resubmit: true, pause: false } });
    const resubmission = buildBoostEstimateRequest(createAdDraftFromBoost(rejected));
    expect(resubmission).toMatchObject({ destinationType: "post", targetId: "post-6", audience: { gender: "male", states: ["NG-LA"] } });
  });

  it("shows the ad balance pots and withdraws once per key after a fee quote", async () => {
    const balance = await resolveMockApiRequest<AdBalance>("GET", "/api/v1/ads/boosts/balance", undefined);
    expect(balance).toMatchObject({ withdrawal: expect.any(Object), topUp: expect.any(Object), cashback: expect.any(Object) });
    const transactions = await resolveMockApiRequest<{ data: { pot: string; kind: string }[] }>("GET", "/api/v1/ads/boosts/balance/transactions", undefined);
    expect(transactions.data.every((row) => (row.pot === "balance" || row.pot === "credit") && typeof row.kind === "string")).toBe(true);
    const topUp = await resolveMockApiRequest<{ checkoutUrl: string }>("POST", "/api/v1/ads/boosts/balance/top-ups", { amount: balance.topUp.minimum }, "top-up-key-1");
    expect(topUp.checkoutUrl).toMatch(/^https:\/\//);
    if (!balance.withdrawal.available) return;
    const amount = { amountMinor: Math.min(balance.withdrawable.amountMinor, balance.withdrawal.minimum.amountMinor), currency: balance.withdrawable.currency };
    const quote = await resolveMockApiRequest<AdBalanceWithdrawalQuote>("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", { amount });
    expect(quote.net.amountMinor).toBe(amount.amountMinor - quote.fee.amountMinor);
    const first = await resolveMockApiRequest<{ id: string }>("POST", "/api/v1/ads/boosts/balance/withdrawals", { amount }, "withdraw-key-1");
    const replay = await resolveMockApiRequest<{ id: string }>("POST", "/api/v1/ads/boosts/balance/withdrawals", { amount }, "withdraw-key-1");
    expect(replay.id).toBe(first.id);
    const after = await resolveMockApiRequest<AdBalance>("GET", "/api/v1/ads/boosts/balance", undefined);
    expect(after.balance.amountMinor).toBe(balance.balance.amountMinor - amount.amountMinor);
    await expect(resolveMockApiRequest("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", { amount: { amountMinor: after.withdrawable.amountMinor + 1_000_000, currency: amount.currency } })).rejects.toMatchObject({ code: "WITHDRAWAL_ABOVE_AVAILABLE" });
  });

  it("serves states for the audience picker", async () => {
    const states = await resolveMockApiRequest<{ data: { type: string; code: string }[] }>("GET", "/api/v1/ads/locations?countryCode=NG&search=lag", undefined);
    expect(states.data).toEqual([expect.objectContaining({ type: "state", code: "NG-LA" })]);
  });

  it("sends guests to sign in", async () => {
    await expect(resolveMockApiRequest("GET", "/api/v1/ads/boosts", undefined, undefined, true)).rejects.toMatchObject({ status: 401 });
    await expect(resolveMockApiRequest("GET", "/api/v1/ads/boosts/balance", undefined, undefined, true)).rejects.toMatchObject({ status: 401 });
  });
});
