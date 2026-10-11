import type { PayoutOnboardingSummary } from "@/types/payoutOnboarding.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export type PayoutSetupCardContext = "creator" | "seller";

export function formatCountdownUntil(isoDate: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(isoDate) - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function describePayoutSetupCard(state: PayoutOnboardingSummary | null | undefined, forcedContext?: PayoutSetupCardContext, now: number = Date.now()) {
  if (!state || state.status === "verified") return null;
  const context: PayoutSetupCardContext = forcedContext ?? (state.role === "creator" ? "creator" : "seller");
  const waiting = state.accountStatus === "pending_creation" && state.completedSteps.length > 0;
  const ready = state.accountStatus === "documentsRequired" && state.status === "in_progress";
  const withdrawable = state.pendingWithdrawable ? formatMoneyForDisplay(state.pendingWithdrawable) : null;
  const title = state.status === "pending_review" ? "Payouts are in review"
    : state.status === "action_needed" ? "Action needed on your payouts"
    : ready ? (withdrawable ? `Verify your ID to withdraw ${withdrawable}` : "Your payout account is ready. Verify your ID")
    : waiting ? "Setting up your payout account"
    : context === "creator" ? "Set up payouts to receive gift earnings" : "Set up payouts to withdraw your sales";
  const body = context === "seller" && state.firstEarningsUnlockAt
    ? `Selling works as normal. Your first earnings unlock for withdrawal in ${formatCountdownUntil(state.firstEarningsUnlockAt, now)}, and withdrawing needs payout setup. Finish before then and nothing waits.`
    : context === "creator"
      ? "Gifts keep adding up while you set this up. Withdrawing needs it. It takes about 5 minutes and covers your seller earnings too."
      : "Earnings are recorded while you set this up. Withdrawing needs it.";
  const actionLabel = state.completedSteps.length === 0 ? "Get started" : state.status === "action_needed" ? "See what's needed" : "Continue";
  return { title, body, actionLabel };
}
