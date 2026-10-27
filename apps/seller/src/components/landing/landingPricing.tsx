import { freePlanPromise, planHighlightsByPlan } from "@/config/planFeatures.config";
import type { SubscriptionPlan } from "@/types/subscription.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./landingPricing.module.css";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";

function findYearlyPlanForTier(plans: readonly SubscriptionPlan[], tier: SubscriptionPlan["tier"]): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.tier === tier && plan.interval === "year");
}

export function LandingPricing({ plans, locale, prelaunch = false }: { readonly plans: SubscriptionPlan[]; readonly locale: string; readonly prelaunch?: boolean }) {
  const monthlyPlans = plans.filter((plan) => plan.interval === "month");
  const plansToShow = monthlyPlans.length > 0 ? monthlyPlans : plans;
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-heading">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Who it is for</p>
          <h2 id="pricing-heading" className={styles.heading}>
            <span className={styles.goldWord}>Free</span> for every Nantty seller.
          </h2>
          <p className={styles.lede}>
            {freePlanPromise} Sign in with your Nantty app account — no Gold verification or paid plan needed. Paid plans show in your local currency.
          </p>
        </div>
        {plansToShow.length === 0 ? (
          <p className={styles.unavailable}>{prelaunch ? "Paid plan pricing will be available at launch. The Free plan remains available to every seller." : "Paid plan prices are loading slowly right now. The Free plan is always available — just sign in."}</p>
        ) : (
          <ul className={styles.planGrid}>
            <li className={styles.planCard}>
              <div className={styles.planHeader}>
                <h3 className={styles.planName}>Free</h3>
              </div>
              <p className={styles.price}>
                Free<span> forever</span>
              </p>
              <ul className={styles.entitlements}>
                {planHighlightsByPlan.free.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
              <PrelaunchLoginAction className={styles.planButton}>
                Sign in free
              </PrelaunchLoginAction>
            </li>
            {plansToShow.map((plan) => {
              const yearlyPlan = findYearlyPlanForTier(plans, plan.tier);
              const planName = plan.tier === "BUSINESS" ? "Business" : "Pro";
              return (
                <li key={plan.id} className={`${styles.planCard} ${plan.tier === "BUSINESS" ? styles.premium : ""}`}>
                  <div className={styles.planHeader}>
                    <span className={styles.badge} aria-hidden="true">
                      <NanttyIcon name="check16" size={14} />
                    </span>
                    <h3 className={styles.planName}>{planName}</h3>
                  </div>
                  <p className={styles.price}>
                    {formatMoneyForDisplay(plan.price, locale)}
                    <span>/{plan.interval === "year" ? "year" : "month"}</span>
                  </p>
                  {yearlyPlan && plan.interval === "month" ? <p className={styles.yearly}>or {formatMoneyForDisplay(yearlyPlan.price, locale)} a year</p> : null}
                  <ul className={styles.entitlements}>
                    {planHighlightsByPlan[plan.tier === "BUSINESS" ? "business" : "pro"].map((highlight) => (
                      <li key={highlight}>{highlight}</li>
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
                  <PrelaunchLoginAction className={styles.planButton}>
                    Sign in to upgrade to {planName}
                  </PrelaunchLoginAction>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
