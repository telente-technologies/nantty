"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { StatusBadge } from "@/components/ui/statusBadge";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { planHighlightsByPlan, sellerPlanLabels, type SellerPlan } from "@/config/planFeatures.config";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { SubscriptionPlan } from "@/types/subscription.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./subscriptionPlanPicker.module.css";

function convertTierToSellerPlan(tier: SubscriptionPlan["tier"]): SellerPlan {
  return tier === "BUSINESS" ? "business" : "pro";
}

function PlanHighlightsList({ plan }: { readonly plan: SellerPlan }) {
  return (
    <ul className={styles.entitlements}>
      {planHighlightsByPlan[plan].map((highlight) => (
        <li key={highlight}>
          <ZudoIcon name="check16" size={14} /> {highlight}
        </li>
      ))}
    </ul>
  );
}

export function SubscriptionPlanPicker({ currentPlanId, currentPlan }: { readonly currentPlanId: string | null; readonly currentPlan: SellerPlan }) {
  const plansQuery = useSellerQuery<CursorPage<SubscriptionPlan>>("/seller/subscription/plans");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startHostedCheckoutForPlan(planId: string) {
    setPendingPlanId(planId);
    setErrorMessage(null);
    try {
      const checkout = await sendSellerApiRequest<{ authorizationUrl: string }>("/seller/subscription/checkout", { method: "POST", body: { planId } });
      const checkoutUrl = new URL(checkout.authorizationUrl, window.location.origin);
      if (checkoutUrl.protocol !== "https:" && checkoutUrl.origin !== window.location.origin) throw new Error("Unexpected payment page.");
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setPendingPlanId(null);
    }
  }

  if (plansQuery.isLoading) return <LoadingBlock label="Loading plans" />;
  if (!plansQuery.data) return <Callout tone="error">{plansQuery.errorMessage ?? "Plans could not be loaded."}</Callout>;
  const paidPlans = plansQuery.data.data.filter((plan) => plan.interval === billingInterval);
  const hasYearlyPlans = plansQuery.data.data.some((plan) => plan.interval === "year");

  return (
    <div className={styles.picker}>
      {hasYearlyPlans ? (
        <SegmentedControl label="Billing period" value={billingInterval} onValueChange={setBillingInterval} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
      ) : null}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <div className={styles.planGrid}>
        <article className={styles.planCard}>
          <header className={styles.planHeader}>
            <h3 className={styles.planName}>Free</h3>
            {currentPlan === "free" ? <StatusBadge tone="success">Current plan</StatusBadge> : null}
          </header>
          <p className={styles.price}>Free<span className={styles.interval}> forever</span></p>
          <PlanHighlightsList plan="free" />
          <p className={styles.footnote}>Basic selling is never locked.</p>
        </article>
        {paidPlans.map((plan) => {
          const sellerPlan = convertTierToSellerPlan(plan.tier);
          const isCurrentPlan = plan.id === currentPlanId;
          const planName = sellerPlanLabels[sellerPlan];
          return (
            <article key={plan.id} className={`${styles.planCard} ${sellerPlan === "business" ? styles.premium : ""}`}>
              <header className={styles.planHeader}>
                <span className={styles.goldMark}>
                  <ZudoIcon name="star16" size={16} />
                </span>
                <h3 className={styles.planName}>{planName}</h3>
                {isCurrentPlan ? <StatusBadge tone="success">Current plan</StatusBadge> : null}
              </header>
              <p className={styles.price}>
                {formatMoneyForDisplay(plan.price)}
                <span className={styles.interval}>/{plan.interval === "year" ? "year" : "month"}</span>
              </p>
              <PlanHighlightsList plan={sellerPlan} />
              {plan.perks.length > 0 ? (
                <ul className={styles.perks}>
                  {plan.perks.map((perk) => (
                    <li key={perk.title}>
                      <strong>{perk.title}</strong>
                      <span>{perk.description}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button variant={sellerPlan === "business" ? "tender" : "primary"} size="large" fullWidth disabled={isCurrentPlan || pendingPlanId !== null} isBusy={pendingPlanId === plan.id} onClick={() => void startHostedCheckoutForPlan(plan.id)}>
                {isCurrentPlan ? "Your plan" : currentPlanId ? `Switch to ${planName}` : `Upgrade to ${planName}`}
              </Button>
            </article>
          );
        })}
      </div>
      <p className={styles.footnote}>You pay on our payment partner&apos;s secure page and come straight back here. Prices are in your store&apos;s currency.</p>
    </div>
  );
}
