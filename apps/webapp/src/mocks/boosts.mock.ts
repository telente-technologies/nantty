import { ApiError } from "@/errors/api.error";
import type { AdBalance, AdBalanceTransaction, BoostBudgetChangeRequest, BoostReport } from "@/types/adsHub.type";
import type { Boost, BoostEstimate, BoostEstimateRequest, BoostOptions, BoostPaymentOption, BoostStatus, CreateBoostRequest } from "@/types/boost.type";
import type { Money } from "@/types/money.type";

import { getSignedInMockUser, signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildWalletSummary, signedInUserIsPayoutVerified } from "./wallet.mock";

const MINIMUM_DAILY_BUDGET_USD_CENTS = 100;
const REACH_PER_USD_CENT = 3.2;
const FREE_BOOST_MAX_TOTAL_USD_CENTS = 700;
const MAXIMUM_DURATION_DAYS = 30;
const freeBoostsUsedByUserId = new Map<string, number>();
const adFundsUsdCentsByUserId = new Map<string, { balance: number; credit: number }>();
const adHistoryByUserId = new Map<string, AdBalanceTransaction[]>();

const nextMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
};

const adFundsFor = (userId: string) => {
  if (!adFundsUsdCentsByUserId.has(userId)) adFundsUsdCentsByUserId.set(userId, { balance: 1_500, credit: 500 });
  return adFundsUsdCentsByUserId.get(userId)!;
};

const recordAdHistory = (userId: string, entry: Omit<AdBalanceTransaction, "id" | "createdAt">) => {
  const history = adHistoryByUserId.get(userId) ?? [];
  history.unshift({ ...entry, id: `adtx_${Date.now()}_${history.length}`, createdAt: new Date().toISOString() });
  adHistoryByUserId.set(userId, history);
};

const buildFreeBoost = () => {
  const premium = signedInUserIsTheDemoSeller();
  const remainingThisMonth = premium ? Math.max(0, 1 - (freeBoostsUsedByUserId.get(getSignedInMockUser().id) ?? 0)) : 0;
  return { premium, eligible: premium && remainingThisMonth > 0, remainingThisMonth, maxTotal: convertUsdCentsToViewerCurrency(FREE_BOOST_MAX_TOTAL_USD_CENTS), resetsAt: nextMonthStart() };
};

interface MockBoost {
  readonly id: string;
  readonly ownerId: string;
  request: CreateBoostRequest;
  totalUsdCents: number;
  durationDays: number;
  readonly createdAt: number;
  status: BoostStatus;
  rejectionReason: string | null;
}
const boosts = new Map<string, MockBoost>();

const committedUsdCents = (userId: string) =>
  [...boosts.values()].filter((record) => record.ownerId === userId && ["in_review", "active", "paused"].includes(record.status)).reduce((sum, record) => sum + Math.round(record.totalUsdCents * (1 - spentFractionOf(record))), 0);

const spendableUsdCents = (userId: string) => {
  const funds = adFundsFor(userId);
  return Math.max(0, funds.balance + funds.credit - committedUsdCents(userId));
};

const buildPaymentOptions = (): BoostPaymentOption[] => {
  const freeBoost = buildFreeBoost();
  const spendable = spendableUsdCents(getSignedInMockUser().id);
  return [
    { method: "card", available: true, reasonCode: null, reason: null },
    { method: "ad_balance", available: spendable > 0, reasonCode: spendable > 0 ? null : "NO_AD_FUNDS", reason: spendable > 0 ? null : "You have no ad credit or balance." },
    signedInUserIsPayoutVerified() ? { method: "balance", available: true, reasonCode: null, reason: null } : { method: "balance", available: false, reasonCode: "VERIFICATION_REQUIRED", reason: "Verify payouts to pay from your earnings." },
    !freeBoost.premium ? { method: "free", available: false, reasonCode: "PREMIUM_REQUIRED", reason: "Free boosts come with Premium." }
      : freeBoost.eligible ? { method: "free", available: true, reasonCode: null, reason: null } : { method: "free", available: false, reasonCode: "FREE_BOOST_USED", reason: "You've used this month's free boost." },
  ];
};

const buildOptions = (): BoostOptions => {
  const userId = getSignedInMockUser().id;
  const funds = adFundsFor(userId);
  return {
    minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
    suggestedDailyBudgets: [100, 300, 700, 1_500].map(convertUsdCentsToViewerCurrency),
    durationDayOptions: [1, 3, 7, 14],
    interests: ["Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"],
    paymentMethods: signedInUserIsTheDemoSeller() ? ["card", "balance", "free"] : ["card", "balance"],
    freeBoost: buildFreeBoost(),
    paymentOptions: buildPaymentOptions(),
    adBalance: {
      accountId: `adacct_${userId}`, balance: convertUsdCentsToViewerCurrency(funds.balance), credit: convertUsdCentsToViewerCurrency(funds.credit),
      committed: convertUsdCentsToViewerCurrency(committedUsdCents(userId)), spendable: convertUsdCentsToViewerCurrency(spendableUsdCents(userId)),
    },
    maximumDurationDays: MAXIMUM_DURATION_DAYS,
    maximumScheduleDays: 60,
    goalsByDestination: { post: ["views", "profile_visits", "messages"], profile: ["profile_visits"], store: ["store_visits"], product: ["product_visits"] },
  };
};

const totalUsdCentsFor = (request: BoostEstimateRequest) => {
  if (request.budgetType === "total" && request.totalBudget) return convertViewerMoneyToUsdCents(request.totalBudget);
  return convertViewerMoneyToUsdCents(request.dailyBudget) * request.durationDays;
};

const estimate = (request: BoostEstimateRequest): BoostEstimate => {
  if (!Number.isInteger(request.durationDays) || request.durationDays < 1 || request.durationDays > MAXIMUM_DURATION_DAYS) throw new ApiError(400, "Choose 1 to 30 days.", "VALIDATION_FAILED");
  const totalUsdCents = totalUsdCentsFor(request);
  if (totalUsdCents < MINIMUM_DAILY_BUDGET_USD_CENTS * request.durationDays) throw new ApiError(400, "Your daily budget is below the minimum", "VALIDATION_FAILED");
  const narrowing = request.audience.mode === "custom" ? 0.7 : 1;
  const reachMid = Math.round(totalUsdCents * REACH_PER_USD_CENT * narrowing);
  const results = {
    views: `${Math.round(reachMid * 1.4).toLocaleString()} views`, profile_visits: `${Math.round(reachMid * 0.04).toLocaleString()} profile visits`, messages: `${Math.max(1, Math.round(reachMid * 0.006))} messages`,
    store_visits: `${Math.round(reachMid * 0.03).toLocaleString()} store visits`, product_visits: `${Math.round(reachMid * 0.03).toLocaleString()} product visits`,
  };
  return { estimatedReachMin: Math.round(reachMid * 0.8), estimatedReachMax: Math.round(reachMid * 1.25), estimatedResultsLabel: `About ${results[request.goal]}`, totalCost: convertUsdCentsToViewerCurrency(totalUsdCents) };
};

const chargeOrThrow = (request: CreateBoostRequest, totalCost: Money) => {
  const userId = getSignedInMockUser().id;
  const totalUsdCents = convertViewerMoneyToUsdCents(totalCost);
  if (request.paymentMethod === "free") {
    const freeBoost = buildFreeBoost();
    if (!freeBoost.premium) throw new ApiError(403, "Free boosts are included with Premium.", "FREE_BOOST_NOT_AVAILABLE");
    if (freeBoost.remainingThisMonth <= 0) throw new ApiError(409, "You have already used this month's free boost.", "FREE_BOOST_USED");
    if (totalCost.amountMinor > freeBoost.maxTotal.amountMinor) throw new ApiError(422, "This boost is larger than your free boost allows.", "FREE_BOOST_TOO_LARGE");
    freeBoostsUsedByUserId.set(userId, (freeBoostsUsedByUserId.get(userId) ?? 0) + 1);
    return;
  }
  if (request.paymentMethod === "balance") {
    if (!signedInUserIsPayoutVerified()) throw new ApiError(403, "Verify your payout details to use Zudomart Ads. Your verification keeps advertisers and creators safe.", "VERIFICATION_REQUIRED");
    if (totalCost.amountMinor > buildWalletSummary().available.amountMinor) throw new ApiError(422, "Amount is more than your available balance.", "INSUFFICIENT_FUNDS");
    return;
  }
  if (request.paymentMethod === "ad_balance") {
    if (totalUsdCents > spendableUsdCents(userId)) throw new ApiError(402, "Your ad credit and balance are less than this costs.", "INSUFFICIENT_AD_BALANCE");
    return;
  }
  if (request.paymentMethod !== "card") throw new ApiError(400, "Choose how to pay for this boost.", "VALIDATION_FAILED");
};

const spentFractionOf = (record: MockBoost) => {
  if (record.status === "in_review" || record.status === "pending_payment" || record.status === "rejected") return 0;
  const hoursRunning = Math.max(0, (Date.now() - record.createdAt) / 3_600_000);
  return Math.min(1, 0.15 + hoursRunning / (record.durationDays * 24));
};

const presentBoost = (record: MockBoost): Boost => {
  const progress = spentFractionOf(record);
  const status: BoostStatus = record.status === "active" && progress >= 1 ? "completed" : record.status;
  const reach = Math.round(record.totalUsdCents * REACH_PER_USD_CENT * progress);
  const destinationType = record.request.destinationType ?? "post";
  const goal = record.request.goal;
  const clicks = Math.round(reach * 0.035);
  const results = {
    impressions: Math.round(reach * 1.6), reach, clicks,
    profileVisits: goal === "profile_visits" ? clicks : 0, storeVisits: goal === "store_visits" ? clicks : 0, productVisits: goal === "product_visits" ? clicks : 0, messages: goal === "messages" ? Math.round(reach * 0.006) : 0,
  };
  const keyValue = goal === "views" ? reach : goal === "messages" ? results.messages : clicks;
  const keyLabel = { views: "People reached", profile_visits: "Profile visits", messages: "Messages", store_visits: "Store visits", product_visits: "Product visits" }[goal];
  const spent = convertUsdCentsToViewerCurrency(Math.round(record.totalUsdCents * progress));
  const live = status === "active" || status === "paused" || status === "in_review";
  return {
    id: record.id,
    postId: destinationType === "post" ? (record.request.postId ?? record.request.targetId ?? "") : "",
    destinationType,
    targetId: record.request.targetId ?? record.request.postId ?? "",
    status,
    goal,
    budgetType: record.request.budgetType ?? "daily",
    dailyBudget: convertUsdCentsToViewerCurrency(Math.ceil(record.totalUsdCents / record.durationDays)),
    durationDays: record.durationDays,
    scheduledStartAt: record.request.startAt ?? null,
    createdAt: new Date(record.createdAt).toISOString(),
    audience: record.request.audience,
    totalBudget: convertUsdCentsToViewerCurrency(record.totalUsdCents),
    spent,
    startsAt: status === "in_review" ? null : new Date(record.createdAt).toISOString(),
    endsAt: status === "in_review" ? null : new Date(record.createdAt + record.durationDays * 86_400_000).toISOString(),
    results,
    keyResult: { label: keyLabel, value: keyValue },
    costPerResult: keyValue > 0 ? { amountMinor: Math.round(spent.amountMinor / keyValue), currency: spent.currency } : null,
    rejectionReason: record.rejectionReason,
    paymentMethod: record.request.paymentMethod,
    actions: { pause: status === "active", resume: status === "paused", stop: live || status === "pending_payment", changeBudget: live, resubmit: status === "rejected" },
  };
};

const ownBoostOrThrow = (boostId: string) => {
  const record = boosts.get(boostId);
  if (!record) throw new ApiError(404, "Not found.", "NOT_FOUND");
  if (record.ownerId !== getSignedInMockUser().id) throw new ApiError(403, "You can't change someone else's ad.", "FORBIDDEN");
  return record;
};

const transitionOrThrow = (record: MockBoost, from: readonly BoostStatus[], to: BoostStatus) => {
  const current = presentBoost(record).status;
  if (!from.includes(current)) throw new ApiError(409, "That status change is not allowed.", "BOOST_STATUS_CHANGE_NOT_ALLOWED");
  record.status = to;
  return presentBoost(record);
};

const quoteChange = (record: MockBoost, request: BoostBudgetChangeRequest) => {
  const current = presentBoost(record);
  if (!["in_review", "active", "paused"].includes(current.status)) throw new ApiError(409, "This ad's budget can't be changed now.", "BOOST_BUDGET_CHANGE_NOT_ALLOWED");
  const extraDays = Math.round(request.extraDays ?? 0);
  if (extraDays < 0 || extraDays > MAXIMUM_DURATION_DAYS) throw new ApiError(400, "Add 0 to 30 days.", "VALIDATION_FAILED");
  const currentDaily = Math.ceil(record.totalUsdCents / record.durationDays);
  const newDaily = request.dailyBudget ? convertViewerMoneyToUsdCents(request.dailyBudget) : currentDaily;
  if (newDaily < currentDaily) throw new ApiError(400, "The daily budget can only go up.", "VALIDATION_FAILED");
  const remainingDays = Math.max(1, Math.ceil(record.durationDays * (1 - spentFractionOf(record))));
  const additional = record.request.budgetType === "total"
    ? (request.additionalBudget ? convertViewerMoneyToUsdCents(request.additionalBudget) : 0)
    : (newDaily - currentDaily) * remainingDays + newDaily * extraDays;
  if (additional <= 0 && extraDays === 0) throw new ApiError(400, "Add days or raise the budget.", "VALIDATION_FAILED");
  const durationDays = record.durationDays + extraDays;
  return { additional, durationDays, newDaily, endsAt: current.endsAt ? new Date(new Date(current.endsAt).getTime() + extraDays * 86_400_000).toISOString() : null };
};

const changePaymentOptions = (): BoostPaymentOption[] => buildPaymentOptions().map((option) =>
  option.method === "card" || option.method === "ad_balance" ? option : { ...option, available: false, reasonCode: "NOT_AVAILABLE_FOR_CHANGES", reason: "Pay for budget changes by card or with ad credit and balance." });

const buildReport = (record: MockBoost): BoostReport => {
  const boost = presentBoost(record);
  const days = boost.startsAt ? Math.max(1, Math.min(record.durationDays, Math.ceil((Date.now() - record.createdAt) / 86_400_000))) : 0;
  const series = Array.from({ length: days }, (_, index) => {
    const share = (index + 1) / ((days * (days + 1)) / 2);
    const date = new Date(record.createdAt + index * 86_400_000).toISOString().slice(0, 10);
    return { date, impressions: Math.round(boost.results.impressions * share), reach: Math.round(boost.results.reach * share), clicks: Math.round((boost.results.clicks ?? 0) * share), results: Math.round((boost.keyResult?.value ?? 0) * share), spend: { amountMinor: Math.round(boost.spent.amountMinor * share), currency: boost.spent.currency } };
  });
  return { currency: boost.totalBudget.currency, resultLabel: boost.keyResult?.label ?? "Results", totals: { impressions: boost.results.impressions, reach: boost.results.reach, clicks: boost.results.clicks ?? 0, results: boost.keyResult?.value ?? 0, spend: boost.spent, costPerResult: boost.costPerResult ?? null }, series };
};

const buildAdBalance = (): AdBalance => {
  const userId = getSignedInMockUser().id;
  const funds = adFundsFor(userId);
  const verified = signedInUserIsPayoutVerified();
  const withdrawable = Math.max(0, funds.balance - Math.max(0, committedUsdCents(userId) - funds.credit));
  return {
    accountId: `adacct_${userId}`, balance: convertUsdCentsToViewerCurrency(funds.balance), credit: convertUsdCentsToViewerCurrency(funds.credit),
    committed: convertUsdCentsToViewerCurrency(committedUsdCents(userId)), spendable: convertUsdCentsToViewerCurrency(spendableUsdCents(userId)),
    withdrawable: convertUsdCentsToViewerCurrency(withdrawable), pendingSettlement: convertUsdCentsToViewerCurrency(0),
    creditLots: funds.credit > 0 ? [{ id: "lot_welcome", source: "admin_issued", remaining: convertUsdCentsToViewerCurrency(funds.credit), expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), reason: "Welcome credit", createdAt: new Date().toISOString() }] : [],
    cashback: { enabled: false, percent: 0 },
    topUp: { available: verified, reasonCode: verified ? null : "VERIFICATION_REQUIRED", reason: verified ? null : "Verify payouts to add funds to your ad balance.", minimum: convertUsdCentsToViewerCurrency(500), maximum: convertUsdCentsToViewerCurrency(500_000), suggested: [1_000, 3_000, 10_000].map(convertUsdCentsToViewerCurrency) },
    withdrawal: !verified ? { available: false, reasonCode: "VERIFICATION_REQUIRED", reason: "Verify payouts to withdraw your ad balance.", minimum: convertUsdCentsToViewerCurrency(100) }
      : withdrawable <= 0 ? { available: false, reasonCode: "NOTHING_TO_WITHDRAW", reason: "There's nothing to withdraw right now.", minimum: convertUsdCentsToViewerCurrency(100) }
        : { available: true, reasonCode: null, reason: null, minimum: convertUsdCentsToViewerCurrency(100) },
  };
};

const withdrawalQuote = (amount: Money) => {
  const balance = buildAdBalance();
  if (!amount || amount.amountMinor <= 0) throw new ApiError(400, "Enter an amount above zero.", "VALIDATION_FAILED");
  if (amount.amountMinor > balance.withdrawable.amountMinor) throw new ApiError(422, "That's more than you can withdraw.", "WITHDRAWAL_ABOVE_AVAILABLE");
  const fee = { amountMinor: Math.min(Math.round(amount.amountMinor * 0.015), 200_000), currency: amount.currency };
  return { amount, fee, net: { amountMinor: amount.amountMinor - fee.amountMinor, currency: amount.currency }, destination: "wallet" as const, withdrawable: balance.withdrawable };
};

const VALID_STATUSES = new Set<BoostStatus>(["pending_payment", "in_review", "active", "paused", "completed", "rejected", "cancelled"]);

export const seedRejectedMockBoost = (request: CreateBoostRequest, reason: string): string => {
  const id = `bst_rejected_${Date.now()}`;
  boosts.set(id, { id, ownerId: getSignedInMockUser().id, request, totalUsdCents: totalUsdCentsFor(request), durationDays: request.durationDays, createdAt: Date.now(), status: "rejected", rejectionReason: reason });
  return id;
};

export const boostsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/ads/boosts/options", () => buildOptions()),
  createMockRoute("GET", "/api/v1/ads/boosts/balance", () => buildAdBalance()),
  createMockRoute("GET", "/api/v1/ads/boosts/balance/transactions", () => ({ data: adHistoryByUserId.get(getSignedInMockUser().id) ?? [], nextCursor: null })),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/top-ups", ({ body }) => {
    if (!signedInUserIsPayoutVerified()) throw new ApiError(403, "Verify your payout details to use Zudomart Ads.", "VERIFICATION_REQUIRED");
    const amount = (body as { amount?: Money }).amount;
    if (!amount || amount.amountMinor <= 0) throw new ApiError(400, "Enter an amount above zero.", "VALIDATION_FAILED");
    const reference = `adtop_${Date.now()}`;
    return { topUpId: reference, reference, checkoutUrl: `/pay/demo?reference=${reference}&next=${encodeURIComponent("/ads/balance")}` };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", ({ body }) => withdrawalQuote((body as { amount: Money }).amount)),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/withdrawals", ({ body }) => {
    if (!signedInUserIsPayoutVerified()) throw new ApiError(403, "Verify your payout details to withdraw.", "VERIFICATION_REQUIRED");
    const quote = withdrawalQuote((body as { amount: Money }).amount);
    const userId = getSignedInMockUser().id;
    adFundsFor(userId).balance -= convertViewerMoneyToUsdCents(quote.amount);
    recordAdHistory(userId, { pot: "balance", kind: "withdrawal", amount: { amountMinor: -quote.amount.amountMinor, currency: quote.amount.currency }, description: "To your Zudomart wallet" });
    return { id: `adwd_${Date.now()}`, status: "completed", amount: quote.amount, fee: quote.fee, net: quote.net, destination: "wallet", createdAt: new Date().toISOString() };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/estimate", ({ body }) => estimate(body as BoostEstimateRequest)),
  createMockRoute("GET", "/api/v1/ads/boosts", ({ query }) => {
    const statuses = (query.get("status") ?? "").split(",").filter(Boolean);
    if (statuses.some((status) => !VALID_STATUSES.has(status as BoostStatus))) throw new ApiError(400, "Unknown status filter.", "VALIDATION_FAILED");
    const userId = getSignedInMockUser().id;
    const mine = [...boosts.values()].filter((record) => record.ownerId === userId).map(presentBoost).filter((boost) => statuses.length === 0 || statuses.includes(boost.status)).reverse();
    return { data: mine, nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts", ({ body }) => {
    const request = body as CreateBoostRequest;
    const user = getSignedInMockUser();
    const ownedTargets = [user.id, user.storeId].filter(Boolean);
    if (request.destinationType === "product" && !user.storeId) throw new ApiError(403, "You can only promote a post, profile or store you own or manage.", "DESTINATION_NOT_OWNED");
    if (request.destinationType && request.destinationType !== "post" && request.destinationType !== "product" && !ownedTargets.includes(request.targetId ?? "")) throw new ApiError(403, "You can only promote a post, profile or store you own or manage.", "DESTINATION_NOT_OWNED");
    const totalCost = estimate(request).totalCost;
    chargeOrThrow(request, totalCost);
    const record: MockBoost = { id: `bst_${Date.now()}_${boosts.size}`, ownerId: user.id, request, totalUsdCents: convertViewerMoneyToUsdCents(totalCost), durationDays: request.durationDays, createdAt: Date.now(), status: "active", rejectionReason: null };
    boosts.set(record.id, record);
    return { boost: presentBoost(record), checkoutUrl: request.paymentMethod === "card" ? `/pay/demo?reference=${record.id}&next=${encodeURIComponent(`/ads/${record.id}`)}` : null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId", ({ params }) => {
    const record = boosts.get(params.boostId!);
    if (!record || record.ownerId !== getSignedInMockUser().id) throw new ApiError(404, "Boost not found", "NOT_FOUND");
    return presentBoost(record);
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId/report", ({ params }) => {
    const record = boosts.get(params.boostId!);
    if (!record || record.ownerId !== getSignedInMockUser().id) throw new ApiError(404, "Boost not found", "NOT_FOUND");
    return buildReport(record);
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/pause", ({ params }) => transitionOrThrow(ownBoostOrThrow(params.boostId!), ["active"], "paused")),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/resume", ({ params }) => transitionOrThrow(ownBoostOrThrow(params.boostId!), ["paused"], "active")),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/cancel", ({ params }) => {
    const record = ownBoostOrThrow(params.boostId!);
    if (record.status === "cancelled") return presentBoost(record);
    return transitionOrThrow(record, ["pending_payment", "in_review", "active", "paused"], "cancelled");
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/budget/quote", ({ params, body }) => {
    const record = ownBoostOrThrow(params.boostId!);
    const quote = quoteChange(record, body as BoostBudgetChangeRequest);
    return {
      additionalCost: convertUsdCentsToViewerCurrency(quote.additional), newDailyBudget: convertUsdCentsToViewerCurrency(quote.newDaily), newTotalBudget: convertUsdCentsToViewerCurrency(record.totalUsdCents + quote.additional),
      newDurationDays: quote.durationDays, newEndsAt: quote.endsAt, paymentOptions: changePaymentOptions(),
    };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/budget", ({ params, body }) => {
    const record = ownBoostOrThrow(params.boostId!);
    const request = body as BoostBudgetChangeRequest & { paymentMethod: string };
    if (request.paymentMethod !== "card" && request.paymentMethod !== "ad_balance") throw new ApiError(400, "Pay by card or with ad credit and balance.", "VALIDATION_FAILED");
    const quote = quoteChange(record, request);
    if (request.paymentMethod === "ad_balance" && quote.additional > spendableUsdCents(record.ownerId)) throw new ApiError(402, "Your ad credit and balance are less than this costs.", "INSUFFICIENT_AD_BALANCE");
    record.totalUsdCents += quote.additional;
    record.durationDays = quote.durationDays;
    const changeId = `bchg_${Date.now()}`;
    return {
      boost: presentBoost(record), change: { id: changeId, status: request.paymentMethod === "card" ? "pending_payment" : "applied", additionalCost: convertUsdCentsToViewerCurrency(quote.additional) },
      checkoutUrl: request.paymentMethod === "card" ? `/pay/demo?reference=${changeId}&next=${encodeURIComponent(`/ads/${record.id}`)}` : null,
    };
  }),
  createMockRoute("GET", "/api/v1/ads/locations", ({ query }) => {
    const search = (query.get("search") ?? "").toLowerCase();
    const country = (query.get("countryCode") ?? "").toUpperCase();
    const catalogue = [
      { type: "country", code: "NG", name: "Nigeria", countryCode: "NG", parentName: null },
      { type: "country", code: "GH", name: "Ghana", countryCode: "GH", parentName: null },
      { type: "country", code: "KE", name: "Kenya", countryCode: "KE", parentName: null },
      { type: "state", code: "NG-LA", name: "Lagos", countryCode: "NG", parentName: "Nigeria" },
      { type: "state", code: "NG-FC", name: "FCT Abuja", countryCode: "NG", parentName: "Nigeria" },
      { type: "state", code: "NG-RI", name: "Rivers", countryCode: "NG", parentName: "Nigeria" },
      { type: "state", code: "GH-AA", name: "Greater Accra", countryCode: "GH", parentName: "Ghana" },
    ];
    if (search.length > 80 || (country && country.length !== 2)) throw new ApiError(400, "Use up to 80 characters and a two-letter country code.", "VALIDATION_FAILED");
    return { data: catalogue.filter((location) => (!country || location.countryCode === country) && (!search || `${location.name} ${location.code}`.toLowerCase().includes(search))), nextCursor: null };
  }),
];
