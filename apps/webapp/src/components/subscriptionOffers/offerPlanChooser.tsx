"use client";

import type { OfferInterval, OfferPlanPreview } from "@/types/subscriptionOffer.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./subscriptionOffer.module.css";

export interface OfferSelection {
  readonly planCode: string;
  readonly interval: OfferInterval;
}

const intervalLabels: Record<OfferInterval, string> = { month: "Monthly", year: "Yearly" };

export function OfferPlanChooser({ plans, selection, onSelect }: { readonly plans: readonly OfferPlanPreview[]; readonly selection: OfferSelection | null; readonly onSelect: (selection: OfferSelection) => void }) {
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.choicesLegend}>Choose how you&apos;d like to pay</legend>
      {plans.filter((plan) => plan.availableForProfile).flatMap((plan) =>
        plan.prices.map((price) => {
          const isSelected = selection?.planCode === plan.planCode && selection.interval === price.interval;
          return (
            <label key={`${plan.planCode}:${price.interval}`} className={isSelected ? `${styles.choice} ${styles.choiceSelected}` : styles.choice}>
              <input type="radio" name="offerPlan" className={styles.choiceInput} checked={isSelected} onChange={() => onSelect({ planCode: plan.planCode, interval: price.interval })} />
              <span className={styles.choiceText}>
                <span className={styles.choiceTitle}>{plan.planLabel} · {intervalLabels[price.interval]}</span>
                {price.offerApplies ? null : <span className={styles.choiceNote}>Your current price is already lower, so you&apos;ll keep it instead.</span>}
              </span>
              <span className={styles.choicePrice}>
                {price.offerApplies ? <s className={styles.wasPrice}>{formatMoneyForDisplay(price.regularPrice)}</s> : null}
                <strong>{formatMoneyForDisplay(price.offerApplies ? price.offerPrice : price.regularPrice)}</strong>
              </span>
            </label>
          );
        }),
      )}
    </fieldset>
  );
}
