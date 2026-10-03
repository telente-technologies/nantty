"use client";

import { Callout } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import { formatCountdownUntil } from "@/utils/payoutName.util";

export function PayoutSetupBanner() {
  const { formatMoney } = useMoneyFormatter();
  const { data: state } = useSellerQuery<PayoutOnboardingState>("/seller/payout-onboarding");
  if (!state || state.status === "verified") return null;
  const isReady = state.accountStatus === "documentsRequired" && state.status === "in_progress";
  const title = state.status === "pending_review" ? "Payouts are in review" : state.status === "action_needed" ? "Action needed on your payouts" : isReady ? (state.pendingWithdrawable ? `Verify your ID to withdraw ${formatMoney(state.pendingWithdrawable)}` : "Verify your ID to withdraw") : state.completedSteps.length === 0 ? "Set up payouts to withdraw your sales" : "Finish payout setup";
  const lock = state.firstEarningsUnlockAt ? ` Your first earnings unlock for withdrawal in ${formatCountdownUntil(state.firstEarningsUnlockAt)}, and withdrawing needs payout setup. Finish before then and nothing waits.` : "";
  return (
    <Callout tone="info" title={title} action={<ButtonLink href="/settings/payouts" variant="primary" size="small">{state.status === "action_needed" ? "See what's needed" : "Continue"}</ButtonLink>}>
      Selling works as normal.{lock}
    </Callout>
  );
}
