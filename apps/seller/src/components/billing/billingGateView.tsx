"use client";

import { GoldPlanPicker } from "@/components/billing/goldPlanPicker";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Callout } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/panel";
import { doesRoleHavePermission } from "@/config/rolePermissions.config";

const subscriptionProblemMessages: Record<string, string> = {
  past_due: "Your last Gold payment did not go through. Pay now to get back into the dashboard.",
  cancelled: "Your Gold plan was cancelled. Choose a plan to switch the dashboard back on.",
  expired: "Your Gold plan has expired. Renew to get back into the dashboard.",
  suspended: "Your Gold plan is suspended. Contact Zudomart support if you think this is a mistake.",
};

export function BillingGateView() {
  const { sessionView } = useSellerSession();
  const subscriptionStatus = sessionView?.access.subscription?.status;
  const canManageBilling = doesRoleHavePermission(sessionView?.access.role ?? null, "billing:manage");
  return (
    <>
      <PageHeader eyebrow={sessionView?.access.storeName ?? "Your store"} title="Go Gold to open your dashboard" description="Gold verification puts a gold badge on your store and unlocks the point of sale, stock, reports and payouts on the web." />
      {subscriptionStatus && subscriptionProblemMessages[subscriptionStatus] ? <Callout tone="caution">{subscriptionProblemMessages[subscriptionStatus]}</Callout> : null}
      {canManageBilling ? (
        <GoldPlanPicker currentPlanId={null} />
      ) : (
        <Callout tone="info" title="Only the store owner can choose a plan">
          Ask the owner of {sessionView?.access.storeName ?? "this store"} to sign in and pick Gold Pro or Gold Premium.
        </Callout>
      )}
    </>
  );
}
