"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { StatusBadge } from "@/components/ui/statusBadge";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { planHighlightsByPlan, sellerPlanLabels, type SellerPlan } from "@/config/planFeatures.config";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { computeDisplayedPrice } from "@/components/billing/billingPricing.util";
import { isCountryRequiredError, useCountryRequiredRetry } from "@/components/billing/countryRequiredDialog";
import { countryRequiredCode as COUNTRY_REQUIRED } from "@/utils/countryRequired.util";
import type { BillingOffer } from "@/types/billingOffer.type";
import type { CursorPage } from "@/types/pagination.type";
import type { SubscriptionPlan } from "@/types/subscription.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import styles from "./subscriptionPlanPicker.module.css";

function convertTierToSellerPlan(tier: SubscriptionPlan["tier"]): SellerPlan {
  return tier === "BUSINESS" ? "business" : "pro";
}

function PlanHighlightsList({ plan }: { readonly plan: SellerPlan }) {
  return (
    <ul className={styles.entitlements}>
      {planHighlightsByPlan[plan].map((highlight) => (
        <li key={highlight}>
          <NanttyIcon name="check16" size={14} /> {highlight}
        </li>
      ))}
    </ul>
  );
}

export function SubscriptionPlanPicker({ currentPlanId, currentPlan, offer }: { readonly currentPlanId: string | null; readonly currentPlan: SellerPlan; readonly offer: BillingOffer | null }) {
  const plansQuery = useSellerQuery<CursorPage<SubscriptionPlan>>("/seller/subscription/plans");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { retry: countryRetry, dialog: countryDialog } = useCountryRequiredRetry();

  async function startHostedCheckoutForPlan(planId: string) {
    setPendingPlanId(planId);
    setErrorMessage(null);
    try {
      const isTrialStart = planId.startsWith("gold_only") || (offer?.isEligible ?? false);
      const checkout = await sendSellerApiRequest<{ authorizationUrl?: string; checkoutUrl?: string; reference: string }>(isTrialStart ? "/seller/subscription/trial/checkout" : "/seller/subscription/checkout", { method: "POST", body: { planId } });
      if (openHostedCheckout(checkout) === "blocked") throw new Error("Unexpected payment page.");
    } catch (error) {
      setPendingPlanId(null);
      if (isCountryRequiredError(error) && countryRetry.handle(COUNTRY_REQUIRED, () => void startHostedCheckoutForPlan(planId))) return;
      setErrorMessage(readErrorMessageForDisplay(error));
    }
  }

  if (plansQuery.isLoading) return <LoadingBlock label="Loading plans" />;
  if (!plansQuery.data) return <ErrorCallout variant="section" error={plansQuery.error} message={plansQuery.errorMessage ?? "Plans could not be loaded."} onRetry={plansQuery.reload} />;
  const paidPlans = plansQuery.data.data.filter((plan) => plan.interval === billingInterval);
  const hasYearlyPlans = plansQuery.data.data.some((plan) => plan.interval === "year");

  return (
    <div className={styles.picker}>
      {countryDialog}
      {hasYearlyPlans ? (
        <SegmentedControl label="Billing period" value={billingInterval} onValueChange={setBillingInterval} options={[{ value: "month", label: "Monthly" }, { value: "year", label: offer ? `Yearly (save ${offer.yearlyDiscountPercent}%)` : "Yearly" }]} />
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
          const monthlyPlan = (plansQuery.data?.data ?? []).find((candidate) => candidate.tier === plan.tier && candidate.interval === "month") ?? plan;
          const displayed = computeDisplayedPrice(monthlyPlan.price, plan.interval, offer);
          const startsTrial = offer?.isEligible === true && !isCurrentPlan;
          return (
            <article key={plan.id} className={`${styles.planCard} ${sellerPlan === "business" ? styles.premium : ""}`}>
              <header className={styles.planHeader}>
                <span className={styles.goldMark}>
                  <NanttyIcon name="star16" size={16} />
                </span>
                <h3 className={styles.planName}>{planName}</h3>
                {isCurrentPlan ? <StatusBadge tone="success">Current plan</StatusBadge> : null}
              </header>
              <p className={styles.price}>
                {formatMoneyForDisplay(displayed.price)}
                <span className={styles.interval}>/{plan.interval === "year" ? "year" : "month"}</span>
              </p>
              {displayed.listPrice ? <p className={styles.footnote}><s>{formatMoneyForDisplay(displayed.listPrice)}</s> · {displayed.note}</p> : displayed.note ? <p className={styles.footnote}>{displayed.note}</p> : null}
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
                {isCurrentPlan ? "Your plan" : startsTrial ? `Start ${offer?.trialDays === 7 ? "7-day" : "1-month"} free trial` : currentPlanId ? `Switch to ${planName}` : `Upgrade to ${planName}`}
              </Button>
            </article>
          );
        })}
        {offer && currentPlan === "free" && plansQuery.data ? (
          <article className={styles.planCard}>
            <header className={styles.planHeader}>
              <span className={styles.goldMark}><NanttyIcon name="sealCheck20" size={16} /></span>
              <h3 className={styles.planName}>Gold only</h3>
              {offer.goldOnlyPlan.isActive ? <StatusBadge tone="success">Current plan</StatusBadge> : null}
            </header>
            <p className={styles.footnote}>For brands and businesses that do not sell on Nantty.</p>
            {(() => {
              const gold = computeDisplayedPrice(offer.goldOnlyPlan.monthly, billingInterval, offer);
              return <p className={styles.price}>{formatMoneyForDisplay(gold.price)}<span className={styles.interval}>/{billingInterval}</span></p>;
            })()}
            <ul className={styles.entitlements}>
              <li><NanttyIcon name="check16" size={14} /> Gold checkmark and brand page features</li>
              <li><NanttyIcon name="check16" size={14} /> No seller dashboard tools</li>
              <li><NanttyIcon name="check16" size={14} /> Gold shows only after your business is verified</li>
            </ul>
            <Button size="large" fullWidth disabled={offer.goldOnlyPlan.isActive || pendingPlanId !== null} isBusy={pendingPlanId === "gold_only"} onClick={() => void startHostedCheckoutForPlan(billingInterval === "year" ? "gold_only_yearly" : "gold_only_monthly")}>{offer.goldOnlyPlan.isActive ? "Your plan" : "Choose Gold only"}</Button>
          </article>
        ) : null}
      </div>
      <p className={styles.footnote}>You pay on our payment partner&apos;s secure page and come straight back here. Prices are in your store&apos;s currency.</p>
    </div>
  );
}
