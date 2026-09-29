import Link from "next/link";

import type { SubscriptionPlan } from "@/types/subscription.type";
import { describeGoldEntitlements } from "@/utils/goldEntitlements.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./landingPricing.module.css";

function findYearlyPlanForTier(plans: readonly SubscriptionPlan[], tier: SubscriptionPlan["tier"]): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.tier === tier && plan.interval === "year");
}

export function LandingPricing({ plans, locale }: { readonly plans: SubscriptionPlan[]; readonly locale: string }) {
  const monthlyPlans = plans.filter((plan) => plan.interval === "month");
  const plansToShow = monthlyPlans.length > 0 ? monthlyPlans : plans;
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Who it is for</p>
          <h2 id="pricing-heading" className={styles.heading}>
            Verified businesses on <span className={styles.goldWord}>Gold</span>.
          </h2>
          <p className={styles.lede}>
            The dashboard comes with Gold verification — the same plan that puts the gold badge on your store in the app. Pick the plan in the app or here after you sign in. Prices show in your local currency.
          </p>
        </div>
        {plansToShow.length === 0 ? (
          <p className={styles.unavailable}>Plans are loading slowly right now. Sign in or open the Zudomart app to see Gold prices.</p>
        ) : (
          <ul className={styles.planGrid}>
            {plansToShow.map((plan) => {
              const yearlyPlan = findYearlyPlanForTier(plans, plan.tier);
              const planName = `Gold ${plan.tier === "PREMIUM" ? "Premium" : "Pro"}`;
              return (
                <li key={plan.id} className={`${styles.planCard} ${plan.tier === "PREMIUM" ? styles.premium : ""}`}>
                  <div className={styles.planHeader}>
                    <span className={styles.badge} aria-hidden="true">
                      ✓
                    </span>
                    <h3 className={styles.planName}>{planName}</h3>
                  </div>
                  <p className={styles.price}>
                    {formatMoneyForDisplay(plan.price, locale)}
                    <span>/{plan.interval === "year" ? "year" : "month"}</span>
                  </p>
                  {yearlyPlan && plan.interval === "month" ? <p className={styles.yearly}>or {formatMoneyForDisplay(yearlyPlan.price, locale)} a year</p> : null}
                  <ul className={styles.entitlements}>
                    {describeGoldEntitlements(plan.entitlements, locale).map((description) => (
                      <li key={description}>{description}</li>
                    ))}
                  </ul>
                  <ul className={styles.perks}>
                    {plan.perks.map((perk) => (
                      <li key={perk.title}>
                        <strong>{perk.title}</strong>
                        <span>{perk.description}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={styles.planButton}>
                    Sign in to choose {planName}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
