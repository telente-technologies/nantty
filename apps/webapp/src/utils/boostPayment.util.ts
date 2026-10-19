import type { BoostOptions, BoostPaymentMethod, FreeBoostAllowance } from "../types/boost.type";
import type { Money } from "../types/money.type";

const KNOWN_METHODS: readonly BoostPaymentMethod[] = ["card", "ad_balance", "balance", "free"];

export function readBoostPaymentMethods(options: BoostOptions): readonly BoostPaymentMethod[] {
  const listed = Array.isArray(options.paymentMethods) ? options.paymentMethods.filter((method) => KNOWN_METHODS.includes(method)) : [];
  return listed.length > 0 ? listed : ["card"];
}

export function readUsableFreeBoost(options: BoostOptions): FreeBoostAllowance | null {
  const freeBoost = options.freeBoost;
  if (!freeBoost || !readBoostPaymentMethods(options).includes("free")) return null;
  if (!freeBoost.premium || !freeBoost.eligible || !(freeBoost.remainingThisMonth > 0) || !freeBoost.maxTotal) return null;
  return freeBoost;
}

export const boostTotalFor = (dailyBudget: Money, days: number): Money => ({ amountMinor: dailyBudget.amountMinor * days, currency: dailyBudget.currency });

export const fitsWithinMoney = (amount: Money, limit: Money): boolean => amount.currency === limit.currency && amount.amountMinor <= limit.amountMinor;

export function pickFreeBoostSelection(budgets: readonly Money[], dayOptions: readonly number[], maxTotal: Money, preferredDays: number | null): { readonly budgetIndex: number; readonly days: number } | null {
  const pickFor = (days: number) => {
    const fitting = budgets.map((budget, index) => ({ budget, index })).filter(({ budget }) => fitsWithinMoney(boostTotalFor(budget, days), maxTotal));
    const best = fitting.reduce<(typeof fitting)[number] | null>((top, entry) => (!top || entry.budget.amountMinor > top.budget.amountMinor ? entry : top), null);
    return best ? { budgetIndex: best.index, days } : null;
  };
  const preferred = preferredDays === null ? null : pickFor(preferredDays);
  if (preferred) return preferred;
  for (const days of [...dayOptions].sort((a, b) => a - b)) {
    const selection = pickFor(days);
    if (selection) return selection;
  }
  return null;
}

const BOOST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  FREE_BOOST_NOT_AVAILABLE: "Free boosts are a Premium perk. Choose another way to pay.",
  FREE_BOOST_USED: "You've already used this month's free boost. Choose another way to pay.",
  FREE_BOOST_TOO_LARGE: "This promotion costs more than your free boost covers. Lower the budget or the number of days.",
  VERIFICATION_REQUIRED: "Verify your payout details to pay from your Zudomart balance.",
  VERIFICATION_UNAVAILABLE: "We couldn't check your verification just now. Try again in a moment, or pay by card or bank transfer.",
  INSUFFICIENT_FUNDS: "Your available balance is less than this promotion costs. Pay by card or bank transfer instead.",
  PAYMENT_METHOD_NOT_AVAILABLE_IN_APP: "This way of paying isn't available here. Pay by card or bank transfer instead.",
  INSUFFICIENT_AD_BALANCE: "Your ad balance is less than this costs. Top up your ad balance or pay by card.",
  DESTINATION_NOT_OWNED: "You can only promote a post, product, profile or store you own or manage.",
  DESTINATION_UNAVAILABLE: "This can't be promoted right now because it's suspended or no longer active.",
  BOOST_STATUS_CHANGE_NOT_ALLOWED: "This ad can't do that in its current state. Refresh to see the latest status.",
  BOOST_BUDGET_CHANGE_NOT_ALLOWED: "This ad's budget can't be changed now.",
  BOOST_ENDED: "This ad's end date has passed. Extend it or duplicate it to run again.",
  IDEMPOTENCY_KEY_REUSED: "This was already sent with different details. Please try again.",
};

export function boostErrorMessageForCode(code: string | null | undefined): string | null {
  return code ? (BOOST_ERROR_MESSAGES[code] ?? null) : null;
}

export function describeBoostPaymentMethod(method: string | null | undefined): string | null {
  if (method === "card") return "card or bank transfer";
  if (method === "balance" || method === "wallet") return "your Zudomart balance";
  if (method === "free") return "your free Premium boost";
  if (method === "ad_balance") return "your ad balance";
  return null;
}
