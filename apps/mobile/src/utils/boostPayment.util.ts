import { ApiError } from "@/errors/api.error";
import type { BoostOptions, FreeBoostAllowance } from "@/types/boost.type";
import type { Money } from "@/types";

export type NativeBoostPaymentMethod = "card" | "free";

export interface BoostSelection {
  readonly dailyBudget: Money;
  readonly durationDays: number;
}

export const NATIVE_BOOST_PAYMENT_NOTE = "Boosts in the app are paid by card or bank transfer in a secure payment window.";

const BOOST_ERROR_MESSAGES: Record<string, string> = {
  FREE_BOOST_NOT_AVAILABLE: "Free boosts come with Premium. You can still boost this post by card or bank transfer.",
  FREE_BOOST_USED: "You've already used this month's free boost. You can boost by card or bank transfer instead.",
  FREE_BOOST_TOO_LARGE: "This boost is bigger than your free boost covers. Pick a smaller package or pay by card.",
  PAYMENT_METHOD_NOT_AVAILABLE_IN_APP: "Paying from your earnings is available on zudomart.com. In the app, pay by card or bank transfer, or from your ad balance.",
  INSUFFICIENT_AD_BALANCE: "Your ad balance doesn't cover this. Pay by card or bank transfer, or lower the budget.",
  DESTINATION_NOT_OWNED: "You can only promote a post, product, profile or store you own or manage.",
  DESTINATION_UNAVAILABLE: "This can't be promoted right now because it's suspended or no longer active.",
  BOOST_STATUS_CHANGE_NOT_ALLOWED: "This ad can't be changed that way any more. Pull down to refresh.",
  BOOST_ENDED: "This ad has reached its end date. Extend it to keep it running.",
  BOOST_BUDGET_CHANGE_NOT_ALLOWED: "The budget of this ad can't be changed any more.",
  BOOST_NOT_CANCELLABLE: "This ad has already finished.",
  FORBIDDEN: "Only the person who created this ad can change it.",
  WITHDRAWAL_ABOVE_AVAILABLE: "That is more than you can withdraw right now.",
  TOP_UPS_UNAVAILABLE: "Top-ups are not available right now. Try again later.",
  VERIFICATION_REQUIRED: "Verify your payout details to use Nantty Ads.",
  VERIFICATION_UNAVAILABLE: "We couldn't check your verification just now. Please try again in a moment.",
  IDEMPOTENCY_KEY_REUSED: "This boost was already sent. Please try again.",
};

export const FREE_BOOST_ERROR_CODES = new Set(["FREE_BOOST_NOT_AVAILABLE", "FREE_BOOST_USED", "FREE_BOOST_TOO_LARGE"]);

export function nativeBoostPaymentMethods(options: BoostOptions | undefined): readonly NativeBoostPaymentMethod[] {
  const listed = options?.paymentMethods ?? ["card"];
  return listed.filter((method): method is NativeBoostPaymentMethod => method === "card" || method === "free");
}

export function usableFreeBoost(options: BoostOptions | undefined): FreeBoostAllowance | null {
  const free = options?.freeBoost;
  if (!free || !nativeBoostPaymentMethods(options).includes("free")) return null;
  return free.premium && free.eligible && free.remainingThisMonth > 0 && free.maxTotal?.amountMinor > 0 ? free : null;
}

export function freeBoostAvailableLabel(free: FreeBoostAllowance): string {
  return `Free boost available (${free.remainingThisMonth} this month)`;
}

export function fitsWithinFreeBoost(total: Money, free: FreeBoostAllowance): boolean {
  return total.currency === free.maxTotal.currency && total.amountMinor <= free.maxTotal.amountMinor;
}

export function pickFreeBoostSelection(options: BoostOptions, free: FreeBoostAllowance): BoostSelection | null {
  const cap = free.maxTotal;
  const candidates: (BoostSelection & { readonly total: number })[] = [];
  (options.packages ?? []).forEach((boostPackage) => {
    if (boostPackage.currency !== cap.currency || boostPackage.days <= 0) return;
    const daily = Math.floor(boostPackage.priceMinor / boostPackage.days);
    candidates.push({ dailyBudget: { amountMinor: daily, currency: boostPackage.currency }, durationDays: boostPackage.days, total: daily * boostPackage.days });
  });
  if (candidates.length === 0) {
    options.suggestedDailyBudgets.forEach((dailyBudget) => {
      if (dailyBudget.currency !== cap.currency) return;
      options.durationDayOptions.forEach((durationDays) => candidates.push({ dailyBudget, durationDays, total: dailyBudget.amountMinor * durationDays }));
    });
  }
  const fitting = candidates.filter((candidate) => candidate.total > 0 && candidate.total <= cap.amountMinor);
  if (fitting.length === 0) return null;
  const best = fitting.reduce((current, candidate) =>
    candidate.total > current.total || (candidate.total === current.total && candidate.durationDays < current.durationDays) ? candidate : current,
  );
  return { dailyBudget: best.dailyBudget, durationDays: best.durationDays };
}

export function formatFreeBoostReset(resetsAt: string | null | undefined): string | null {
  if (!resetsAt) return null;
  const date = new Date(resetsAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function boostErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code) {
    if (error.code === "VERIFICATION_REQUIRED" && error.message) return error.message;
    const mapped = BOOST_ERROR_MESSAGES[error.code];
    if (mapped) return mapped;
  }
  return error instanceof Error && error.message ? error.message : "Couldn't start your boost. Please try again.";
}

export function describeBoostPaymentMethodForDisplay(method: string | null | undefined): string | null {
  if (method === "card") return "card or bank transfer";
  if (method === "ad_balance") return "your ad credit & balance";
  if (method === "balance" || method === "wallet") return "your Nantty earnings";
  if (method === "free") return "your free Premium boost";
  return null;
}
