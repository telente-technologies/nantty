import type { BoostBudgetChangeRequest, BoostReport } from "@/types/adsHub.type";
import type { Boost, BoostAudience, BoostBudgetType, BoostDestinationType, BoostEstimateRequest, BoostGoal, BoostOptions, BoostPaymentMethod, BoostPaymentOption, BoostStatus } from "@/types/boost.type";
import type { Money } from "@/types/money.type";

import { boostDestinationOf, boostGoalsFor, boostRequestTarget, type BoostDestination } from "./boostDestination.util";

export type AdStatusFilterKey = "all" | "inReview" | "active" | "paused" | "completed" | "rejected";

export interface AdStatusFilter {
  readonly key: AdStatusFilterKey;
  readonly label: string;
  readonly statuses: readonly BoostStatus[];
}

export const AD_STATUS_FILTERS: readonly AdStatusFilter[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "inReview", label: "In review", statuses: ["in_review", "pending_payment"] },
  { key: "active", label: "Active", statuses: ["active"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "completed", label: "Completed", statuses: ["completed", "cancelled"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

export const statusesForAdFilter = (key: AdStatusFilterKey): readonly BoostStatus[] => AD_STATUS_FILTERS.find((filter) => filter.key === key)?.statuses ?? [];

export type AdStatusTone = "neutral" | "caution" | "success" | "error";

const STATUS_APPEARANCE: Record<BoostStatus, { readonly label: string; readonly tone: AdStatusTone }> = {
  pending_payment: { label: "Waiting for payment", tone: "neutral" },
  in_review: { label: "In review", tone: "caution" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
  completed: { label: "Completed", tone: "neutral" },
  rejected: { label: "Rejected", tone: "error" },
  cancelled: { label: "Stopped", tone: "neutral" },
};

export const adStatusAppearance = (status: BoostStatus): { readonly label: string; readonly tone: AdStatusTone } => STATUS_APPEARANCE[status] ?? { label: status, tone: "neutral" };

export const spendFraction = (spent: Money, budget: Money): number => (budget.amountMinor > 0 && spent.currency === budget.currency ? Math.min(1, Math.max(0, spent.amountMinor / budget.amountMinor)) : 0);

export function keyResultForBoost(boost: Boost): { readonly label: string; readonly value: number } {
  if (boost.keyResult) return boost.keyResult;
  const { type } = boostDestinationOf(boost);
  if (type === "store") return { label: "Store visits", value: boost.results.storeVisits ?? 0 };
  if (type === "product") return { label: "Product visits", value: boost.results.productVisits ?? 0 };
  if (boost.goal === "messages") return { label: "Messages", value: boost.results.messages };
  if (boost.goal === "profile_visits") return { label: "Profile visits", value: boost.results.profileVisits };
  return { label: "People reached", value: boost.results.reach };
}

const DESTINATION_NOUNS: Record<BoostDestinationType, string> = { post: "Post", profile: "Profile", store: "Store", product: "Product" };

export const destinationNounFor = (type: BoostDestinationType): string => DESTINATION_NOUNS[type];

export function goalsForDestination(options: BoostOptions | undefined, type: BoostDestinationType) {
  const fallback = boostGoalsFor(type);
  const fromServer = options?.goalsByDestination?.[type];
  if (!fromServer || fromServer.length === 0) return fallback;
  return fromServer.map((goal) => fallback.find((option) => option.id === goal) ?? { id: goal, label: goal.replace(/_/g, " "), hint: "" });
}

const PAYMENT_LABELS: Record<BoostPaymentMethod, string> = { card: "Card or bank transfer", ad_balance: "Ad credit & balance", balance: "Zudomart earnings", free: "Free Premium boost" };

export const paymentMethodLabel = (method: BoostPaymentMethod): string => PAYMENT_LABELS[method] ?? method;

export function readPaymentOptions(options: BoostOptions): readonly BoostPaymentOption[] {
  if (options.paymentOptions && options.paymentOptions.length > 0) return options.paymentOptions;
  const listed = options.paymentMethods && options.paymentMethods.length > 0 ? options.paymentMethods : (["card"] as const);
  return listed.map((method) => ({ method, available: true, reasonCode: null, reason: null }));
}

export interface PaymentOptionState {
  readonly method: BoostPaymentMethod;
  readonly label: string;
  readonly selectable: boolean;
  readonly note: string | null;
}

export interface PaymentOptionContext {
  readonly total: Money | null;
  readonly adFundsSpendable: Money | null;
  readonly earningsAvailable: Money | null;
  readonly freeBoostMaxTotal: Money | null;
}

const covers = (available: Money | null, total: Money | null) => !available || !total || (available.currency === total.currency && available.amountMinor >= total.amountMinor);

export function describePaymentOption(option: BoostPaymentOption, context: PaymentOptionContext, format: (money: Money) => string): PaymentOptionState {
  const label = paymentMethodLabel(option.method);
  if (!option.available) return { method: option.method, label, selectable: false, note: option.reason ?? "Not available right now." };
  if (option.method === "ad_balance") {
    if (!covers(context.adFundsSpendable, context.total)) return { method: option.method, label, selectable: false, note: `Not enough ad credit and balance. You can spend ${format(context.adFundsSpendable!)}.` };
    return { method: option.method, label, selectable: true, note: context.adFundsSpendable ? `You can spend ${format(context.adFundsSpendable)}. Credit is used first.` : null };
  }
  if (option.method === "balance") {
    if (!covers(context.earningsAvailable, context.total)) return { method: option.method, label, selectable: false, note: `Not enough earnings. Available: ${format(context.earningsAvailable!)}.` };
    return { method: option.method, label, selectable: true, note: context.earningsAvailable ? `Available to withdraw: ${format(context.earningsAvailable)}` : null };
  }
  if (option.method === "free") {
    if (!covers(context.freeBoostMaxTotal, context.total)) return { method: option.method, label, selectable: false, note: `Covers up to ${format(context.freeBoostMaxTotal!)}. Lower the budget or days to use it.` };
    return { method: option.method, label, selectable: true, note: context.freeBoostMaxTotal ? `Covers up to ${format(context.freeBoostMaxTotal)} in total.` : null };
  }
  return { method: option.method, label, selectable: true, note: "Secure payment window" };
}

export function firstSelectablePaymentMethod(states: readonly PaymentOptionState[], preferred: BoostPaymentMethod | null): BoostPaymentMethod | null {
  if (preferred && states.some((state) => state.method === preferred && state.selectable)) return preferred;
  return states.find((state) => state.selectable)?.method ?? null;
}

export interface IdempotencyKeyHolder {
  readonly keyFor: (body: unknown) => string;
  readonly reset: () => void;
}

export function createIdempotencyKeyHolder(createKey: () => string): IdempotencyKeyHolder {
  let current: { readonly signature: string; readonly key: string } | null = null;
  return {
    keyFor: (body) => {
      const signature = JSON.stringify(body);
      if (current?.signature !== signature) current = { signature, key: createKey() };
      return current.key;
    },
    reset: () => {
      current = null;
    },
  };
}

export interface ChartBar {
  readonly date: string;
  readonly value: number;
  readonly fraction: number;
}

export function scaleReportSeries(series: BoostReport["series"], metric: "impressions" | "reach" | "clicks" | "results"): readonly ChartBar[] {
  const values = series.map((point) => Math.max(0, point[metric] ?? 0));
  const highest = Math.max(0, ...values);
  return series.map((point, index) => ({ date: point.date, value: values[index]!, fraction: highest > 0 ? values[index]! / highest : 0 }));
}

export interface AdDraft {
  readonly destination: BoostDestination | null;
  readonly goal: BoostGoal | null;
  readonly audience: BoostAudience;
  readonly budgetType: BoostBudgetType;
  readonly dailyBudget: Money | null;
  readonly totalBudget: Money | null;
  readonly durationDays: number;
  readonly startDate: string | null;
}

export const emptyAdDraft = (destination: BoostDestination | null): AdDraft => ({
  destination, goal: destination ? boostGoalsFor(destination.type)[0]?.id ?? null : null, audience: { mode: "automatic" }, budgetType: "daily", dailyBudget: null, totalBudget: null, durationDays: 7, startDate: null,
});

export function draftFromBoost(boost: Boost): AdDraft {
  const destination = boostDestinationOf(boost);
  const budgetType = boost.budgetType ?? "daily";
  return {
    destination,
    goal: boost.goal,
    audience: boost.audience ?? { mode: "automatic" },
    budgetType,
    dailyBudget: boost.dailyBudget ?? null,
    totalBudget: budgetType === "total" ? boost.totalBudget : null,
    durationDays: boost.durationDays ?? 7,
    startDate: null,
  };
}

export const MINIMUM_AGE = 18;
export const MAXIMUM_AGE = 65;

export function audienceIssue(audience: BoostAudience): string | null {
  if (audience.mode === "automatic") return null;
  if (!/^[A-Z]{2}$/.test(audience.countryCode)) return "Choose a country.";
  if (audience.ageMin < MINIMUM_AGE || audience.ageMax > MAXIMUM_AGE || audience.ageMin > audience.ageMax) return `Choose ages between ${MINIMUM_AGE} and ${MAXIMUM_AGE}.`;
  return null;
}

export function startAtFromDate(startDate: string | null, now: Date = new Date()): string | undefined {
  if (!startDate) return undefined;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) return undefined;
  return start.toISOString();
}

export function dailyBudgetForDraft(draft: AdDraft): Money | null {
  if (draft.budgetType === "daily") return draft.dailyBudget;
  if (!draft.totalBudget || draft.durationDays <= 0) return null;
  return { amountMinor: Math.ceil(draft.totalBudget.amountMinor / draft.durationDays), currency: draft.totalBudget.currency };
}

export function estimateRequestFromDraft(draft: AdDraft, now: Date = new Date()): BoostEstimateRequest | null {
  const dailyBudget = dailyBudgetForDraft(draft);
  if (!draft.destination || !draft.goal || !dailyBudget || dailyBudget.amountMinor <= 0 || draft.durationDays <= 0 || audienceIssue(draft.audience)) return null;
  const startAt = startAtFromDate(draft.startDate, now);
  return {
    ...boostRequestTarget(draft.destination),
    goal: draft.goal,
    audience: draft.audience,
    budgetType: draft.budgetType,
    dailyBudget,
    ...(draft.budgetType === "total" && draft.totalBudget ? { totalBudget: draft.totalBudget } : {}),
    durationDays: draft.durationDays,
    ...(startAt ? { startAt } : {}),
  };
}

export function budgetFloorIssue(draft: AdDraft, minimumDaily: Money | undefined, format: (money: Money) => string): string | null {
  if (!minimumDaily) return null;
  if (draft.budgetType === "daily") {
    if (!draft.dailyBudget) return "Enter a daily budget.";
    return draft.dailyBudget.amountMinor < minimumDaily.amountMinor ? `The minimum daily budget is ${format(minimumDaily)}.` : null;
  }
  if (!draft.totalBudget) return "Enter a total budget.";
  const floor = { amountMinor: minimumDaily.amountMinor * draft.durationDays, currency: minimumDaily.currency };
  return draft.totalBudget.amountMinor < floor.amountMinor ? `For ${draft.durationDays} days the minimum total is ${format(floor)}.` : null;
}

export function parseMajorAmountToMinor(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const formatMinorAsMajorInput = (money: Money | null): string => (money ? String(money.amountMinor / 100) : "");

export function adDestinationHref(destination: BoostDestination): string {
  const target = encodeURIComponent(destination.targetId);
  return `/ads/create?type=${destination.type}&target=${target}`;
}

const TRANSACTION_KIND_LABELS: Record<string, string> = {
  top_up: "Top-up", boost_funding: "Ad payment", earnings_funding: "Added from earnings", spent: "Spent on ads", refund: "Refund", withdrawal: "Withdrawn to wallet",
  credit_issued: "Issued by Zudomart", cashback: "Cashback", cashback_reversed: "Cashback reversed", credit_spent: "Spent on ads", credit_expired: "Expired", credit_revoked: "Removed by Zudomart", debt: "Amount owed",
};

export const adTransactionKindLabel = (kind: string): string => TRANSACTION_KIND_LABELS[kind] ?? kind.replace(/_/g, " ");

export const adTransactionPotLabel = (pot: "balance" | "credit"): string => (pot === "credit" ? "Ad credit" : "Ad balance");

const CREDIT_SOURCE_LABELS: Record<string, string> = { admin_issued: "From Zudomart", cashback: "Cashback", premium_free_boost: "Premium free boost", boost_refund: "Ad refund", legacy: "Ad credit" };

export const adCreditSourceLabel = (source: string): string => CREDIT_SOURCE_LABELS[source] ?? "Ad credit";

export function describeCreditLotExpiry(lot: { readonly remaining: Money; readonly expiresAt: string | null }, format: (money: Money) => string, formatDate: (iso: string) => string | null): string {
  const date = lot.expiresAt ? formatDate(lot.expiresAt) : null;
  return date ? `${format(lot.remaining)} expires on ${date}` : `${format(lot.remaining)} · Doesn't expire`;
}

export function buildBudgetChangeRequest(boost: Boost, extraDays: number, amountMinor: number | null): BoostBudgetChangeRequest | null {
  const currency = boost.totalBudget.currency;
  if (boost.budgetType === "total") {
    const additional = amountMinor ?? 0;
    if (extraDays <= 0 && additional <= 0) return null;
    return { extraDays, ...(additional > 0 ? { additionalBudget: { amountMinor: additional, currency } } : {}) };
  }
  const currentDaily = boost.dailyBudget?.amountMinor ?? 0;
  const newDaily = amountMinor ?? currentDaily;
  if (newDaily < currentDaily) return null;
  if (extraDays <= 0 && newDaily === currentDaily) return null;
  return { extraDays, ...(newDaily > currentDaily ? { dailyBudget: { amountMinor: newDaily, currency } } : {}) };
}
