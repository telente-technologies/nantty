import { ApiError } from "@/errors/api.error";
import type {
  AdBalance, AdBalanceTransaction, AdTargetingLocation, Boost, BoostBudgetChangeInput, BoostBudgetChangeRequest, BoostEstimate, BoostEstimateRequest,
  BoostOptions, BoostPaymentOption, BoostStatus, CreateBoostRequest, FreeBoostAllowance,
} from "@/types/boost.type";
import type { Money } from "@/types";

import { getSignedInMockUser, signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency, convertViewerMoneyToUsdCents } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MINIMUM_DAILY_BUDGET_USD_CENTS = 100;
const REACH_PER_USD_CENT = 3.2;
const DAY_MS = 86_400_000;

const FREE_BOOSTS_PER_MONTH = 1;
const FREE_BOOST_MAX_USD_CENTS = MINIMUM_DAILY_BUDGET_USD_CENTS;
const freeBoostsUsedByUserMonth = new Map<string, number>();

const signedInUserHasPremium = () => getSignedInMockUser().verification?.tier === "PREMIUM" || signedInUserIsTheDemoSeller();
const freeBoostUsageKey = () => `${getSignedInMockUser().id}:${new Date().toISOString().slice(0, 7)}`;

const adFunds = { balanceUsdCents: 500, creditUsdCents: 300 };
const adBalanceHistory: AdBalanceTransaction[] = [
  { id: "abt_seed_credit", pot: "credit", kind: "credit_issued", amount: convertUsdCentsToViewerCurrency(300), description: "Welcome credit", createdAt: new Date(Date.now() - 5 * DAY_MS).toISOString() },
  { id: "abt_seed_top_up", pot: "balance", kind: "top_up", amount: convertUsdCentsToViewerCurrency(500), description: "Card top-up", createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString() },
];

const buildFreeBoost = (): FreeBoostAllowance => {
  const premium = signedInUserHasPremium();
  const remaining = premium ? Math.max(0, FREE_BOOSTS_PER_MONTH - (freeBoostsUsedByUserMonth.get(freeBoostUsageKey()) ?? 0)) : 0;
  const now = new Date();
  return {
    premium,
    eligible: premium && remaining > 0,
    remainingThisMonth: remaining,
    maxTotal: convertUsdCentsToViewerCurrency(FREE_BOOST_MAX_USD_CENTS),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
};

interface MockBoost {
  readonly id: string;
  readonly request: CreateBoostRequest;
  totalUsdCents: number;
  dailyUsdCents: number;
  durationDays: number;
  readonly createdAt: number;
  status: BoostStatus;
  endsAt: number | null;
  rejectionReason: string | null;
}
const boosts = new Map<string, MockBoost>();
const appliedBudgetChanges = new Map<string, { readonly boostId: string; readonly signature: string; readonly additionalUsdCents: number }>();

const committedUsdCents = () =>
  [...boosts.values()].filter((record) => record.request.paymentMethod === "ad_balance").filter((record) => record.status === "active" || record.status === "paused" || record.status === "in_review").reduce((sum, record) => sum + Math.round(record.totalUsdCents * (1 - spendProgress(record))), 0);
const spendableUsdCents = () => Math.max(0, adFunds.balanceUsdCents + adFunds.creditUsdCents - committedUsdCents());

const paymentOptions = (): BoostPaymentOption[] => {
  const free = buildFreeBoost();
  return [
    { method: "card", available: true, reasonCode: null, reason: null },
    spendableUsdCents() > 0 ? { method: "ad_balance", available: true, reasonCode: null, reason: null } : { method: "ad_balance", available: false, reasonCode: "NO_AD_FUNDS", reason: "You have no ad credit or balance" },
    { method: "balance", available: false, reasonCode: "NOT_AVAILABLE_IN_APP", reason: "Pay from your earnings on nantty.com" },
    free.premium
      ? free.eligible ? { method: "free", available: true, reasonCode: null, reason: null } : { method: "free", available: false, reasonCode: "FREE_BOOST_USED", reason: "You've used this month's free boost" }
      : { method: "free", available: false, reasonCode: "PREMIUM_REQUIRED", reason: "Free boosts come with Premium" },
  ];
};

const buildOptions = (): BoostOptions => ({
  paymentMethods: signedInUserHasPremium() ? ["card", "free"] : ["card"],
  paymentOptions: paymentOptions(),
  freeBoost: buildFreeBoost(),
  adBalance: {
    accountId: "ads_acc_mock", balance: convertUsdCentsToViewerCurrency(adFunds.balanceUsdCents), credit: convertUsdCentsToViewerCurrency(adFunds.creditUsdCents),
    committed: convertUsdCentsToViewerCurrency(committedUsdCents()), spendable: convertUsdCentsToViewerCurrency(spendableUsdCents()),
  },
  maximumDurationDays: 30,
  maximumScheduleDays: 60,
  goalsByDestination: { post: ["views", "profile_visits", "messages"], profile: ["profile_visits"], store: ["store_visits"], product: ["product_visits"] },
  minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  suggestedDailyBudgets: [100, 300, 700, 1_500].map(convertUsdCentsToViewerCurrency),
  durationDayOptions: [1, 3, 7, 14],
  interests: ["Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"],
  packages: [[1, 1, "1 day"], [3, 3, "3 days"], [7, 7, "1 week"], [15, 7, "1 week, wider reach"]].map(([multiple, days, label]) => {
    const price = convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS * Number(multiple));
    const reachMid = Math.round(MINIMUM_DAILY_BUDGET_USD_CENTS * Number(multiple) * REACH_PER_USD_CENT);
    return { priceMinor: price.amountMinor, currency: price.currency, days: Number(days), label: String(label), estimatedReach: { low: Math.round(reachMid * 0.8), high: Math.round(reachMid * 1.25) }, impressions: { low: reachMid, high: Math.round(reachMid * 1.8) } };
  }),
});

const totalUsdCentsFor = (request: BoostEstimateRequest) => {
  if (request.budgetType === "total" && request.totalBudget) return convertViewerMoneyToUsdCents(request.totalBudget);
  return convertViewerMoneyToUsdCents(request.dailyBudget) * request.durationDays;
};

const estimate = (request: BoostEstimateRequest): BoostEstimate => {
  if (request.durationDays < 1 || request.durationDays > 30) throw new ApiError(400, "Choose between 1 and 30 days.", "VALIDATION_FAILED");
  const totalUsdCents = totalUsdCentsFor(request);
  if (totalUsdCents / request.durationDays < MINIMUM_DAILY_BUDGET_USD_CENTS) throw new ApiError(400, "Your daily budget is below the minimum", "VALIDATION_FAILED");
  const narrowing = request.audience.mode === "custom" ? 0.7 : 1;
  const reachMid = Math.round(totalUsdCents * REACH_PER_USD_CENT * narrowing);
  const results = { views: `${Math.round(reachMid * 1.4).toLocaleString()} views`, profile_visits: `${Math.round(reachMid * 0.04).toLocaleString()} profile visits`, messages: `${Math.max(1, Math.round(reachMid * 0.006))} messages`, store_visits: `${Math.round(reachMid * 0.03).toLocaleString()} store visits`, product_visits: `${Math.round(reachMid * 0.035).toLocaleString()} product views` };
  const totalCost = convertUsdCentsToViewerCurrency(totalUsdCents);
  const clicks = { low: Math.round(reachMid * 0.01), high: Math.round(reachMid * 0.025) };
  return {
    estimatedReachMin: Math.round(reachMid * 0.8), estimatedReachMax: Math.round(reachMid * 1.25), estimatedResultsLabel: `About ${results[request.goal]}`, totalCost,
    impressions: { low: reachMid, high: Math.round(reachMid * 1.8) }, clicks, costPerResultMinor: { low: Math.floor(totalCost.amountMinor / Math.max(clicks.high, 1)), high: Math.ceil(totalCost.amountMinor / Math.max(clicks.low, 1)) },
    minimumDailyBudget: convertUsdCentsToViewerCurrency(MINIMUM_DAILY_BUDGET_USD_CENTS),
  };
};

function spendProgress(record: MockBoost): number {
  if (record.status === "in_review" || record.status === "pending_payment" || record.status === "rejected") return 0;
  const hoursRunning = Math.max(0, (Date.now() - record.createdAt) / 3_600_000);
  return Math.min(1, 0.15 + hoursRunning / (record.durationDays * 24));
}

const currentStatus = (record: MockBoost): BoostStatus => {
  if (record.status === "active" && (spendProgress(record) >= 1 || (record.endsAt !== null && record.endsAt < Date.now()))) record.status = "completed";
  return record.status;
};

const presentBoost = (record: MockBoost): Boost => {
  const status = currentStatus(record);
  const progress = spendProgress(record);
  const reach = Math.round(record.totalUsdCents * REACH_PER_USD_CENT * progress);
  const destinationType = record.request.destinationType ?? "post";
  const results = {
    impressions: Math.round(reach * 1.6), reach, clicks: Math.round(reach * 0.03),
    profileVisits: record.request.goal === "profile_visits" ? Math.round(reach * 0.04) : 0, storeVisits: record.request.goal === "store_visits" ? Math.round(reach * 0.03) : 0,
    productVisits: record.request.goal === "product_visits" ? Math.round(reach * 0.035) : 0, messages: record.request.goal === "messages" ? Math.round(reach * 0.006) : 0,
  };
  const keyValue = { views: results.reach, profile_visits: results.profileVisits, messages: results.messages, store_visits: results.storeVisits, product_visits: results.productVisits }[record.request.goal];
  const keyLabel = { views: "People reached", profile_visits: "Profile visits", messages: "Messages", store_visits: "Store visits", product_visits: "Product views" }[record.request.goal];
  const spent = convertUsdCentsToViewerCurrency(Math.round(record.totalUsdCents * progress));
  const started = status !== "in_review" && status !== "pending_payment" && status !== "rejected";
  return {
    id: record.id,
    postId: destinationType === "post" ? (record.request.postId ?? record.request.targetId ?? "") : "",
    destinationType,
    targetId: record.request.targetId ?? record.request.postId ?? "",
    status,
    goal: record.request.goal,
    budgetType: record.request.budgetType ?? "daily",
    dailyBudget: convertUsdCentsToViewerCurrency(record.dailyUsdCents),
    durationDays: record.durationDays,
    totalBudget: convertUsdCentsToViewerCurrency(record.totalUsdCents),
    spent,
    startsAt: started ? new Date(record.createdAt).toISOString() : null,
    endsAt: started && record.endsAt !== null ? new Date(record.endsAt).toISOString() : null,
    scheduledStartAt: record.request.startAt ?? null,
    createdAt: new Date(record.createdAt).toISOString(),
    audience: record.request.audience,
    results,
    keyResult: { label: keyLabel, value: keyValue },
    costPerResult: keyValue > 0 ? { amountMinor: Math.round(spent.amountMinor / keyValue), currency: spent.currency } : null,
    rejectionReason: record.rejectionReason,
    paymentMethod: record.request.paymentMethod,
    actions: {
      pause: status === "active", resume: status === "paused", stop: ["pending_payment", "in_review", "active", "paused"].includes(status),
      changeBudget: ["in_review", "active", "paused"].includes(status), resubmit: status === "rejected",
    },
  };
};

const requireOwnedBoost = (boostId: string) => {
  const record = boosts.get(boostId);
  if (!record) throw new ApiError(404, "Not found.", "NOT_FOUND");
  return record;
};

const statusChangeRefused = () => new ApiError(409, "That status change is not allowed.", "BOOST_STATUS_CHANGE_NOT_ALLOWED");

const chargeAdFunds = (usdCents: number) => {
  if (spendableUsdCents() < usdCents) throw new ApiError(402, "Your ad credit and balance don't cover this.", "INSUFFICIENT_AD_BALANCE");
};

const quoteChange = (record: MockBoost, input: BoostBudgetChangeInput) => {
  if (!["in_review", "active", "paused"].includes(currentStatus(record))) throw new ApiError(409, "The budget of this ad can't be changed any more.", "BOOST_BUDGET_CHANGE_NOT_ALLOWED");
  const extraDays = Math.max(0, Math.floor(input.extraDays || 0));
  const newDailyUsdCents = input.dailyBudget ? Math.max(record.dailyUsdCents, convertViewerMoneyToUsdCents(input.dailyBudget)) : record.dailyUsdCents;
  const remainingDays = record.endsAt ? Math.max(1, Math.ceil((record.endsAt - Date.now()) / DAY_MS)) : record.durationDays;
  const additionalUsdCents = record.request.budgetType === "total"
    ? (input.additionalBudget ? convertViewerMoneyToUsdCents(input.additionalBudget) : 0)
    : (newDailyUsdCents - record.dailyUsdCents) * remainingDays + newDailyUsdCents * extraDays;
  if (additionalUsdCents <= 0) throw new ApiError(400, "Add days or raise the budget.", "VALIDATION_FAILED");
  const newDurationDays = record.durationDays + extraDays;
  return {
    additionalUsdCents, newDailyUsdCents, newDurationDays, newEndsAt: record.endsAt ? record.endsAt + extraDays * DAY_MS : null,
    quote: {
      additionalCost: convertUsdCentsToViewerCurrency(additionalUsdCents),
      newDailyBudget: convertUsdCentsToViewerCurrency(record.request.budgetType === "total" ? Math.ceil((record.totalUsdCents + additionalUsdCents) / newDurationDays) : newDailyUsdCents),
      newTotalBudget: convertUsdCentsToViewerCurrency(record.totalUsdCents + additionalUsdCents),
      newDurationDays,
      newEndsAt: record.endsAt ? new Date(record.endsAt + extraDays * DAY_MS).toISOString() : null,
      paymentOptions: paymentOptions().map((option) => (option.method === "card" || option.method === "ad_balance" ? option : { ...option, available: false, reasonCode: "NOT_SUPPORTED_FOR_CHANGES", reason: "Use card or ad credit & balance to add budget" })),
    },
  };
};

const buildAdBalance = (): AdBalance => {
  const withdrawable = Math.max(0, adFunds.balanceUsdCents - Math.max(0, committedUsdCents() - adFunds.creditUsdCents));
  return {
    accountId: "ads_acc_mock",
    balance: convertUsdCentsToViewerCurrency(adFunds.balanceUsdCents),
    credit: convertUsdCentsToViewerCurrency(adFunds.creditUsdCents),
    committed: convertUsdCentsToViewerCurrency(committedUsdCents()),
    spendable: convertUsdCentsToViewerCurrency(spendableUsdCents()),
    withdrawable: convertUsdCentsToViewerCurrency(withdrawable),
    pendingSettlement: convertUsdCentsToViewerCurrency(0),
    creditLots: adFunds.creditUsdCents > 0 ? [{ id: "lot_mock_1", source: "admin_issued", remaining: convertUsdCentsToViewerCurrency(adFunds.creditUsdCents), expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(), reason: "Welcome credit", createdAt: new Date(Date.now() - 5 * DAY_MS).toISOString() }] : [],
    cashback: { enabled: signedInUserIsTheDemoSeller(), percent: 10 },
    topUp: { available: true, reasonCode: null, reason: null, minimum: convertUsdCentsToViewerCurrency(100), maximum: convertUsdCentsToViewerCurrency(1_000_000), suggested: [500, 1_000, 2_500].map(convertUsdCentsToViewerCurrency) },
    withdrawal: withdrawable > 0
      ? { available: true, reasonCode: null, reason: null, minimum: convertUsdCentsToViewerCurrency(100) }
      : { available: false, reasonCode: "NOTHING_TO_WITHDRAW", reason: "Nothing to withdraw right now", minimum: convertUsdCentsToViewerCurrency(100) },
  };
};

const withdrawalFeeUsdCents = (amountUsdCents: number) => Math.max(10, Math.round(amountUsdCents * 0.01));
const withdrawalsByKey = new Map<string, unknown>();

const LOCATIONS: readonly AdTargetingLocation[] = [
  { type: "country", code: "NG", name: "Nigeria", countryCode: "NG", parentName: null },
  { type: "country", code: "GH", name: "Ghana", countryCode: "GH", parentName: null },
  { type: "country", code: "KE", name: "Kenya", countryCode: "KE", parentName: null },
  ...[["LA", "Lagos"], ["FC", "FCT Abuja"], ["RI", "Rivers"], ["OY", "Oyo"], ["KN", "Kano"], ["EN", "Enugu"]].map(([code, name]) => ({ type: "state" as const, code: `NG-${code}`, name: name!, countryCode: "NG", parentName: "Nigeria" })),
  { type: "state", code: "GH-AA", name: "Greater Accra", countryCode: "GH", parentName: "Ghana" },
  { type: "state", code: "KE-30", name: "Nairobi County", countryCode: "KE", parentName: "Kenya" },
];

const moneyBody = (body: unknown): Money => {
  const amount = (body as { amount?: Money } | undefined)?.amount;
  if (!amount || !(amount.amountMinor > 0)) throw new ApiError(400, "Enter an amount above zero.", "VALIDATION_FAILED");
  return amount;
};

const requireIdempotencyKey = (key: string | undefined) => {
  if (!key) throw new ApiError(400, "Send an Idempotency-Key header.", "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};

export const boostsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/ads/locations", ({ query }) => {
    const search = (query.get("search") ?? "").toLowerCase();
    const countryCode = query.get("countryCode");
    return { data: LOCATIONS.filter((location) => (!countryCode || location.countryCode === countryCode) && (!search || location.name.toLowerCase().includes(search))), nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/options", () => buildOptions()),
  createMockRoute("POST", "/api/v1/ads/boosts/estimate", ({ body }) => estimate(body as BoostEstimateRequest)),
  createMockRoute("GET", "/api/v1/ads/boosts/balance", () => buildAdBalance()),
  createMockRoute("GET", "/api/v1/ads/boosts/balance/transactions", () => ({ data: [...adBalanceHistory].reverse(), nextCursor: null })),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/top-ups", ({ body, idempotencyKey }) => {
    const amount = moneyBody(body);
    const key = requireIdempotencyKey(idempotencyKey);
    return { topUpId: `top_${key}`, reference: `ref_${key}`, checkoutUrl: `https://checkout.flutterwave.com/v3/hosted/pay/mock-ad-top-up-${amount.amountMinor}` };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/withdrawals/quote", ({ body }) => {
    const amount = moneyBody(body);
    const balance = buildAdBalance();
    if (amount.amountMinor > balance.withdrawable.amountMinor) throw new ApiError(422, "That is more than you can withdraw right now.", "WITHDRAWAL_ABOVE_AVAILABLE");
    const fee = convertUsdCentsToViewerCurrency(withdrawalFeeUsdCents(convertViewerMoneyToUsdCents(amount)));
    return { amount, fee, net: { amountMinor: amount.amountMinor - fee.amountMinor, currency: amount.currency }, destination: "wallet", withdrawable: balance.withdrawable };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/balance/withdrawals", ({ body, idempotencyKey }) => {
    const key = requireIdempotencyKey(idempotencyKey);
    const replay = withdrawalsByKey.get(key);
    if (replay) return replay;
    const amount = moneyBody(body);
    if (amount.amountMinor > buildAdBalance().withdrawable.amountMinor) throw new ApiError(422, "That is more than you can withdraw right now.", "WITHDRAWAL_ABOVE_AVAILABLE");
    const amountUsdCents = convertViewerMoneyToUsdCents(amount);
    const fee = convertUsdCentsToViewerCurrency(withdrawalFeeUsdCents(amountUsdCents));
    adFunds.balanceUsdCents -= amountUsdCents;
    adBalanceHistory.push({ id: `abt_${key}`, pot: "balance", kind: "withdrawal", amount: { amountMinor: -amount.amountMinor, currency: amount.currency }, description: "To your Nantty wallet", createdAt: new Date().toISOString() });
    const result = { id: `wd_${key}`, status: "completed", amount, fee, net: { amountMinor: amount.amountMinor - fee.amountMinor, currency: amount.currency }, destination: "wallet", createdAt: new Date().toISOString() };
    withdrawalsByKey.set(key, result);
    return result;
  }),
  createMockRoute("GET", "/api/v1/ads/boosts", ({ query }) => {
    const statuses = (query.get("status") ?? "").split(",").filter(Boolean);
    const items = [...boosts.values()].sort((a, b) => b.createdAt - a.createdAt).map(presentBoost).filter((boost) => statuses.length === 0 || statuses.includes(boost.status));
    return { data: items, nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/ads/boosts", ({ body, idempotencyKey }) => {
    const request = body as CreateBoostRequest;
    const ownedTargets = [getSignedInMockUser().id, getSignedInMockUser().storeId].filter(Boolean);
    if (request.destinationType && request.destinationType !== "post" && request.destinationType !== "product" && !ownedTargets.includes(request.targetId ?? "")) throw new ApiError(403, "You can only promote a post, profile or store you own or manage.", "DESTINATION_NOT_OWNED");
    const existing = idempotencyKey ? boosts.get(`bst_${idempotencyKey}`) : undefined;
    if (existing) return { boost: presentBoost(existing), checkoutUrl: null };
    const totalCost = estimate(request).totalCost;
    const total = convertViewerMoneyToUsdCents(totalCost);
    if (request.paymentMethod === "balance") throw new ApiError(403, "Paying from your earnings isn't available in the app.", "PAYMENT_METHOD_NOT_AVAILABLE_IN_APP");
    if (request.paymentMethod === "ad_balance") chargeAdFunds(total);
    if (request.paymentMethod === "free") {
      const free = buildFreeBoost();
      if (!free.premium) throw new ApiError(403, "Free boosts come with Premium.", "FREE_BOOST_NOT_AVAILABLE");
      if (free.remainingThisMonth <= 0) throw new ApiError(409, "You've already used this month's free boost.", "FREE_BOOST_USED");
      if (totalCost.amountMinor > free.maxTotal.amountMinor) throw new ApiError(422, "This boost is bigger than your free boost covers.", "FREE_BOOST_TOO_LARGE");
      freeBoostsUsedByUserMonth.set(freeBoostUsageKey(), (freeBoostsUsedByUserMonth.get(freeBoostUsageKey()) ?? 0) + 1);
    }
    const createdAt = Date.now();
    const record: MockBoost = {
      id: idempotencyKey ? `bst_${idempotencyKey}` : `bst_${createdAt}`, request, totalUsdCents: total, dailyUsdCents: Math.ceil(total / request.durationDays), durationDays: request.durationDays,
      createdAt, status: request.paymentMethod === "card" ? "active" : "in_review", endsAt: createdAt + request.durationDays * DAY_MS, rejectionReason: null,
    };
    boosts.set(record.id, record);
    return { boost: presentBoost(record), checkoutUrl: request.paymentMethod === "card" ? `https://checkout.flutterwave.com/v3/hosted/pay/mock-boost-${record.id}` : null };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId", ({ params }) => presentBoost(requireOwnedBoost(params.boostId!))),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/pause", ({ params }) => {
    const record = requireOwnedBoost(params.boostId!);
    if (currentStatus(record) !== "active") throw statusChangeRefused();
    record.status = "paused";
    return presentBoost(record);
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/resume", ({ params }) => {
    const record = requireOwnedBoost(params.boostId!);
    if (record.status !== "paused") throw statusChangeRefused();
    if (record.endsAt !== null && record.endsAt < Date.now()) throw new ApiError(409, "This ad has reached its end date.", "BOOST_ENDED");
    record.status = "active";
    return presentBoost(record);
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/cancel", ({ params }) => {
    const record = requireOwnedBoost(params.boostId!);
    const status = currentStatus(record);
    if (status === "cancelled") return presentBoost(record);
    if (status === "completed" || status === "rejected") throw new ApiError(409, "This boost has already finished.", "BOOST_NOT_CANCELLABLE");
    record.status = "cancelled";
    record.endsAt = Date.now();
    return presentBoost(record);
  }),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/budget/quote", ({ params, body }) => quoteChange(requireOwnedBoost(params.boostId!), body as BoostBudgetChangeInput).quote),
  createMockRoute("POST", "/api/v1/ads/boosts/:boostId/budget", ({ params, body, idempotencyKey }) => {
    const key = requireIdempotencyKey(idempotencyKey);
    const record = requireOwnedBoost(params.boostId!);
    const request = body as BoostBudgetChangeRequest;
    const signature = JSON.stringify(request);
    const replay = appliedBudgetChanges.get(key);
    if (replay) {
      if (replay.signature !== signature || replay.boostId !== record.id) throw new ApiError(409, "That Idempotency-Key was used with a different request.", "IDEMPOTENCY_KEY_REUSED");
      return { boost: presentBoost(record), change: { id: `chg_${key}`, status: "applied", additionalCost: convertUsdCentsToViewerCurrency(replay.additionalUsdCents) }, checkoutUrl: null };
    }
    if (request.paymentMethod !== "card" && request.paymentMethod !== "ad_balance") throw new ApiError(400, "Pay by card or ad credit & balance.", "VALIDATION_FAILED");
    const change = quoteChange(record, request);
    if (request.paymentMethod === "ad_balance") chargeAdFunds(change.additionalUsdCents);
    record.totalUsdCents += change.additionalUsdCents;
    record.dailyUsdCents = change.newDailyUsdCents;
    record.durationDays = change.newDurationDays;
    record.endsAt = change.newEndsAt ?? record.endsAt;
    appliedBudgetChanges.set(key, { boostId: record.id, signature, additionalUsdCents: change.additionalUsdCents });
    const pending = request.paymentMethod === "card";
    return {
      boost: presentBoost(record), change: { id: `chg_${key}`, status: pending ? "pending_payment" : "applied", additionalCost: change.quote.additionalCost },
      checkoutUrl: pending ? `https://checkout.flutterwave.com/v3/hosted/pay/mock-boost-change-${key}` : null,
    };
  }),
  createMockRoute("GET", "/api/v1/ads/boosts/:boostId/report", ({ params }) => {
    const boost = presentBoost(requireOwnedBoost(params.boostId!));
    const days = boost.startsAt ? Math.max(1, Math.min(boost.durationDays ?? 1, Math.ceil((Date.now() - Date.parse(boost.startsAt)) / DAY_MS))) : 0;
    const series = Array.from({ length: days }, (_, index) => {
      const share = 1 / days;
      return {
        date: new Date(Date.parse(boost.startsAt!) + index * DAY_MS).toISOString().slice(0, 10),
        impressions: Math.round(boost.results.impressions * share), reach: Math.round(boost.results.reach * share), clicks: Math.round((boost.results.clicks ?? 0) * share),
        results: Math.round((boost.keyResult?.value ?? 0) * share), spend: { amountMinor: Math.round(boost.spent.amountMinor * share), currency: boost.spent.currency },
      };
    });
    return {
      currency: boost.spent.currency, resultLabel: boost.keyResult?.label ?? "Results",
      totals: { impressions: boost.results.impressions, reach: boost.results.reach, clicks: boost.results.clicks ?? 0, results: boost.keyResult?.value ?? 0, spend: boost.spent, costPerResult: boost.costPerResult ?? null },
      series,
    };
  }),
];

export const rejectMockBoostForTests = (boostId: string, reason: string) => {
  const record = requireOwnedBoost(boostId);
  record.status = "rejected";
  record.rejectionReason = reason;
};
