import type { StatusTone } from "@/components/escrow/statusPill";
import type {
  AdBalanceTransactionKind, AdCreditLot, Boost, BoostAudience, BoostAvailableActions, BoostBudgetChangeInput, BoostBudgetType, BoostDestinationType, BoostEstimateRequest, BoostGoal, BoostOptions,
  BoostPaymentMethod, BoostPaymentOption, BoostReportPoint, BoostStatus,
} from "@/types/boost.type";
import type { Money } from "@/types";
import { boostGoalsFor, boostRequestTarget, type BoostGoalOption } from "@/utils/boostDestination.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface AdStatusFilter {
  readonly key: "all" | "in_review" | "active" | "paused" | "completed" | "rejected";
  readonly label: string;
  readonly statuses: readonly BoostStatus[];
}

export const AD_STATUS_FILTERS: readonly AdStatusFilter[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "in_review", label: "In review", statuses: ["in_review", "pending_payment"] },
  { key: "active", label: "Active", statuses: ["active"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "completed", label: "Completed", statuses: ["completed", "cancelled"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

export const BOOST_STATUS_APPEARANCE: Readonly<Record<BoostStatus, { readonly label: string; readonly tone: StatusTone }>> = {
  pending_payment: { label: "Waiting for payment", tone: "neutral" },
  in_review: { label: "In review", tone: "caution" },
  active: { label: "Active", tone: "primary" },
  paused: { label: "Paused", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  cancelled: { label: "Stopped", tone: "neutral" },
};

export const boostStatusAppearance = (status: BoostStatus) => BOOST_STATUS_APPEARANCE[status] ?? { label: status, tone: "neutral" as const };

export function boostAvailableActions(boost: Pick<Boost, "status" | "actions">): BoostAvailableActions {
  if (boost.actions) return boost.actions;
  const status = boost.status;
  return {
    pause: status === "active",
    resume: status === "paused",
    stop: status === "pending_payment" || status === "in_review" || status === "active" || status === "paused",
    changeBudget: status === "in_review" || status === "active" || status === "paused",
    resubmit: status === "rejected",
  };
}

const KEY_RESULT_LABEL_BY_GOAL: Readonly<Record<BoostGoal, string>> = {
  views: "People reached",
  profile_visits: "Profile visits",
  messages: "Messages",
  store_visits: "Store visits",
  product_visits: "Product views",
};

export function boostKeyResult(boost: Pick<Boost, "goal" | "results" | "keyResult">): { readonly label: string; readonly value: number } {
  if (boost.keyResult) return boost.keyResult;
  const results = boost.results;
  const valueByGoal: Readonly<Record<BoostGoal, number>> = {
    views: results.reach,
    profile_visits: results.profileVisits,
    messages: results.messages,
    store_visits: results.storeVisits ?? 0,
    product_visits: results.productVisits ?? 0,
  };
  return { label: KEY_RESULT_LABEL_BY_GOAL[boost.goal] ?? "Results", value: valueByGoal[boost.goal] ?? 0 };
}

export function boostSpendRatio(boost: Pick<Boost, "spent" | "totalBudget">): number {
  if (boost.totalBudget.amountMinor <= 0) return 0;
  return Math.min(1, Math.max(0, boost.spent.amountMinor / boost.totalBudget.amountMinor));
}

export function goalsForDestination(type: BoostDestinationType, options: BoostOptions | undefined): readonly BoostGoalOption[] {
  const fallback = boostGoalsFor(type);
  const serverGoals = options?.goalsByDestination?.[type];
  if (!serverGoals || serverGoals.length === 0) return fallback;
  return serverGoals.map((goal) => fallback.find((option) => option.id === goal) ?? { id: goal, label: KEY_RESULT_LABEL_BY_GOAL[goal] ?? goal, hint: "" });
}

export const PAYMENT_METHOD_LABELS: Readonly<Record<BoostPaymentMethod, string>> = {
  card: "Card or bank transfer",
  ad_balance: "Ad credit & balance",
  balance: "Zudomart earnings",
  free: "Free Premium boost",
};

export interface BoostPaymentChoice {
  readonly method: BoostPaymentMethod;
  readonly label: string;
  readonly selectable: boolean;
  readonly note: string | null;
}

function legacyPaymentOptions(options: BoostOptions | undefined): readonly BoostPaymentOption[] {
  const listed = options?.paymentMethods ?? ["card"];
  return listed.map((method) => ({ method, available: true, reasonCode: null, reason: null }));
}

export function boostPaymentChoices(options: BoostOptions | undefined, total: Money | null): readonly BoostPaymentChoice[] {
  const serverOptions = options?.paymentOptions && options.paymentOptions.length > 0 ? options.paymentOptions : legacyPaymentOptions(options);
  return serverOptions.filter((option) => option.method in PAYMENT_METHOD_LABELS).map((option) => {
    const label = PAYMENT_METHOD_LABELS[option.method];
    if (!option.available) return { method: option.method, label, selectable: false, note: option.reason ?? "Not available right now" };
    if (option.method === "ad_balance") {
      const spendable = options?.adBalance?.spendable;
      if (spendable && total && (spendable.currency !== total.currency || spendable.amountMinor < total.amountMinor)) {
        return { method: option.method, label, selectable: false, note: `Not enough ad credit and balance. ${formatMoneyForDisplay(spendable)} available.` };
      }
      return { method: option.method, label, selectable: true, note: spendable ? `${formatMoneyForDisplay(spendable)} available. Credit is used first.` : null };
    }
    if (option.method === "free") {
      const free = options?.freeBoost;
      if (!free || !free.eligible || free.remainingThisMonth <= 0) return { method: option.method, label, selectable: false, note: "You've used this month's free boost" };
      if (total && (free.maxTotal.currency !== total.currency || free.maxTotal.amountMinor < total.amountMinor)) {
        return { method: option.method, label, selectable: false, note: `Covers up to ${formatMoneyForDisplay(free.maxTotal, { showDecimals: false })}. Lower the budget to use it.` };
      }
      return { method: option.method, label, selectable: true, note: `Covers up to ${formatMoneyForDisplay(free.maxTotal, { showDecimals: false })}` };
    }
    if (option.method === "card") return { method: option.method, label, selectable: true, note: "Secure payment window" };
    return { method: option.method, label, selectable: true, note: null };
  });
}

export function resolvePaymentMethod(choices: readonly BoostPaymentChoice[], chosen: BoostPaymentMethod | null): BoostPaymentMethod | null {
  if (chosen && choices.some((choice) => choice.method === chosen && choice.selectable)) return chosen;
  return choices.find((choice) => choice.selectable)?.method ?? null;
}

export interface StableIdempotencyKeys {
  readonly keyFor: (body: unknown) => string;
  readonly reset: () => void;
}

export function createStableIdempotencyKeys(generateKey: () => string): StableIdempotencyKeys {
  let current: { readonly signature: string; readonly key: string } | null = null;
  return {
    keyFor: (body) => {
      const signature = JSON.stringify(body);
      if (current?.signature !== signature) current = { signature, key: generateKey() };
      return current.key;
    },
    reset: () => {
      current = null;
    },
  };
}

export type ReportBarMetric = "impressions" | "reach" | "clicks" | "results" | "spend";

export interface ReportBar {
  readonly date: string;
  readonly value: number;
  readonly ratio: number;
}

export function reportBars(series: readonly BoostReportPoint[], metric: ReportBarMetric): readonly ReportBar[] {
  const values = series.map((point) => (metric === "spend" ? point.spend.amountMinor : point[metric]) || 0);
  const highest = Math.max(0, ...values);
  return series.map((point, index) => ({ date: point.date, value: values[index]!, ratio: highest > 0 ? values[index]! / highest : 0 }));
}

export interface CreateAdDestination {
  readonly type: BoostDestinationType;
  readonly targetId: string;
  readonly label?: string;
}

export interface CreateAdDraft {
  readonly destination: CreateAdDestination | null;
  readonly goal: BoostGoal | null;
  readonly audience: BoostAudience;
  readonly budgetType: BoostBudgetType;
  readonly dailyBudget: Money | null;
  readonly totalBudget: Money | null;
  readonly durationDays: number | null;
  readonly startAt: string | null;
}

export const EMPTY_CREATE_AD_DRAFT: CreateAdDraft = {
  destination: null, goal: null, audience: { mode: "automatic" }, budgetType: "daily", dailyBudget: null, totalBudget: null, durationDays: null, startAt: null,
};

export const dailyBudgetFromTotal = (total: Money, days: number): Money => ({ amountMinor: Math.ceil(total.amountMinor / Math.max(days, 1)), currency: total.currency });

export function buildBoostEstimateRequest(draft: CreateAdDraft): BoostEstimateRequest | null {
  const { destination, goal, durationDays } = draft;
  if (!destination || !goal || !durationDays || durationDays < 1) return null;
  const base = { ...boostRequestTarget(destination), goal, audience: draft.audience, durationDays, ...(draft.startAt ? { startAt: draft.startAt } : {}) };
  if (draft.budgetType === "total") {
    if (!draft.totalBudget || draft.totalBudget.amountMinor <= 0) return null;
    return { ...base, budgetType: "total", totalBudget: draft.totalBudget, dailyBudget: dailyBudgetFromTotal(draft.totalBudget, durationDays) };
  }
  if (!draft.dailyBudget || draft.dailyBudget.amountMinor <= 0) return null;
  return { ...base, budgetType: "daily", dailyBudget: draft.dailyBudget };
}

export function createAdDraftFromBoost(boost: Boost): CreateAdDraft {
  const type = boost.destinationType ?? "post";
  const durationDays = boost.durationDays ?? null;
  const budgetType = boost.budgetType ?? "daily";
  return {
    destination: { type, targetId: boost.targetId || boost.postId },
    goal: boost.goal,
    audience: boost.audience ?? { mode: "automatic" },
    budgetType,
    dailyBudget: boost.dailyBudget ?? (durationDays ? dailyBudgetFromTotal(boost.totalBudget, durationDays) : null),
    totalBudget: budgetType === "total" ? boost.totalBudget : null,
    durationDays,
    startAt: null,
  };
}

export function minimumTotalBudget(options: BoostOptions | undefined, durationDays: number | null): Money | null {
  if (!options || !durationDays) return null;
  return { amountMinor: options.minimumDailyBudget.amountMinor * durationDays, currency: options.minimumDailyBudget.currency };
}

export function budgetBelowMinimum(draft: CreateAdDraft, options: BoostOptions | undefined): boolean {
  if (!options || !draft.durationDays) return false;
  const daily = draft.budgetType === "total" ? (draft.totalBudget ? dailyBudgetFromTotal(draft.totalBudget, draft.durationDays) : null) : draft.dailyBudget;
  return !!daily && daily.amountMinor < options.minimumDailyBudget.amountMinor;
}

export const SCHEDULE_START_OPTIONS: readonly { readonly label: string; readonly daysAhead: number | null }[] = [
  { label: "After approval", daysAhead: null },
  { label: "Tomorrow", daysAhead: 1 },
  { label: "In 3 days", daysAhead: 3 },
  { label: "In a week", daysAhead: 7 },
  { label: "In 2 weeks", daysAhead: 14 },
];

export function scheduledStartAt(daysAhead: number | null, now: Date): string | null {
  if (daysAhead === null) return null;
  const start = new Date(now.getTime());
  start.setDate(start.getDate() + daysAhead);
  start.setHours(8, 0, 0, 0);
  return start.toISOString();
}

export const DURATION_DAY_CHOICES = (options: BoostOptions | undefined): readonly number[] => {
  const maximum = options?.maximumDurationDays ?? 14;
  const listed = [...(options?.durationDayOptions ?? [1, 3, 7, 14])];
  if (maximum >= 30 && !listed.includes(30)) listed.push(30);
  return listed.filter((days) => days >= 1 && days <= maximum).sort((a, b) => a - b);
};

export function parseMoneyInput(text: string, currency: Money["currency"]): Money | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { amountMinor: Math.round(value * 100), currency };
}

const TRANSACTION_REASON_BY_KIND: Readonly<Record<AdBalanceTransactionKind, string>> = {
  top_up: "Top-up",
  boost_funding: "Ad payment",
  earnings_funding: "Funded from earnings",
  spent: "Spent on ads",
  refund: "Refund",
  withdrawal: "Withdrawn to wallet",
  credit_issued: "Issued by Zudomart",
  cashback: "Cashback",
  cashback_reversed: "Cashback reversed",
  credit_spent: "Spent on ads",
  credit_expired: "Expired",
  credit_revoked: "Removed by Zudomart",
  debt: "Amount owed",
};

export const adBalanceTransactionReason = (kind: AdBalanceTransactionKind): string => TRANSACTION_REASON_BY_KIND[kind] ?? "Ad balance";

export const adBalancePotLabel = (pot: "balance" | "credit"): string => (pot === "credit" ? "Ad credit" : "Ad balance");

export function adCreditLotExpiryLabel(lot: AdCreditLot): string {
  if (!lot.expiresAt) return `${formatMoneyForDisplay(lot.remaining)} · Doesn't expire`;
  const date = new Date(lot.expiresAt);
  const formatted = Number.isNaN(date.getTime()) ? lot.expiresAt : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${formatMoneyForDisplay(lot.remaining)} expires on ${formatted}`;
}

export function buildBudgetChangeInput(boost: Boost, extraDays: number, dailyBudget: Money | null, additionalBudget: Money | null): BoostBudgetChangeInput | null {
  const isTotal = boost.budgetType === "total";
  const raisesDaily = !isTotal && !!dailyBudget && !!boost.dailyBudget && dailyBudget.amountMinor > boost.dailyBudget.amountMinor;
  const addsTotal = isTotal && !!additionalBudget && additionalBudget.amountMinor > 0;
  if (extraDays <= 0 && !raisesDaily && !addsTotal) return null;
  return { extraDays, ...(raisesDaily ? { dailyBudget: dailyBudget! } : {}), ...(addsTotal ? { additionalBudget: additionalBudget! } : {}) };
}
