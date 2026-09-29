"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { StatusBadge } from "@/components/ui/statusBadge";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { GoldEntitlements } from "@/types/sellerAccess.type";
import type { SubscriptionPlan } from "@/types/subscription.type";
import { formatMoneyForDisplay, isSupportedCurrencyCode } from "@/utils/money.util";

import styles from "./goldPlanPicker.module.css";

export function describeGoldEntitlements(entitlements: GoldEntitlements): string[] {
  const descriptions = [
    entitlements.maxStaffSeats === null ? "Unlimited staff seats" : `${entitlements.maxStaffSeats} staff seats`,
    entitlements.maxLocations === null ? "Unlimited locations" : `${entitlements.maxLocations} ${entitlements.maxLocations === 1 ? "location" : "locations"}`,
  ];
  if (entitlements.adCredits && isSupportedCurrencyCode(entitlements.adCredits.currency)) {
    descriptions.push(`${formatMoneyForDisplay({ amountMinor: entitlements.adCredits.amountMinor, currency: entitlements.adCredits.currency })} ad credit every month`);
  }
  if (entitlements.reducedCommission) descriptions.push("Reduced marketplace commission");
  if (entitlements.priorityPlacement) descriptions.push("Priority placement in Mart and search");
  if (entitlements.apiAccess) descriptions.push("API access");
  return descriptions;
}

export function GoldPlanPicker({ currentPlanId }: { readonly currentPlanId: string | null }) {
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

  if (plansQuery.isLoading) return <LoadingBlock label="Loading Gold plans" />;
  if (!plansQuery.data) return <Callout tone="error">{plansQuery.errorMessage ?? "Plans could not be loaded."}</Callout>;
  const plans = plansQuery.data.data.filter((plan) => plan.interval === billingInterval);
  const hasYearlyPlans = plansQuery.data.data.some((plan) => plan.interval === "year");

  return (
    <div className={styles.picker}>
      {hasYearlyPlans ? (
        <SegmentedControl label="Billing period" value={billingInterval} onValueChange={setBillingInterval} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
      ) : null}
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      <div className={styles.planGrid}>
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          return (
            <article key={plan.id} className={`${styles.planCard} ${plan.tier === "PREMIUM" ? styles.premium : ""}`}>
              <header className={styles.planHeader}>
                <span className={styles.goldMark}>
                  <ZudoIcon name="sealCheck20" size={18} />
                </span>
                <h3 className={styles.planName}>Gold {plan.tier === "PREMIUM" ? "Premium" : "Pro"}</h3>
                {isCurrentPlan ? <StatusBadge tone="success">Current plan</StatusBadge> : null}
              </header>
              <p className={styles.price}>
                {formatMoneyForDisplay(plan.price)}
                <span className={styles.interval}>/{plan.interval === "year" ? "year" : "month"}</span>
              </p>
              <ul className={styles.entitlements}>
                {describeGoldEntitlements(plan.entitlements).map((description) => (
                  <li key={description}>
                    <ZudoIcon name="check16" size={14} /> {description}
                  </li>
                ))}
              </ul>
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
              <Button variant={plan.tier === "PREMIUM" ? "tender" : "primary"} size="large" fullWidth disabled={isCurrentPlan || pendingPlanId !== null} isBusy={pendingPlanId === plan.id} onClick={() => void startHostedCheckoutForPlan(plan.id)}>
                {isCurrentPlan ? "Your plan" : currentPlanId ? `Switch to Gold ${plan.tier === "PREMIUM" ? "Premium" : "Pro"}` : `Get Gold ${plan.tier === "PREMIUM" ? "Premium" : "Pro"}`}
              </Button>
            </article>
          );
        })}
      </div>
      <p className={styles.footnote}>You pay on our payment partner&apos;s secure page and come straight back here. Prices are in your store&apos;s currency.</p>
    </div>
  );
}
