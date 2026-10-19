"use client";

import Link from "next/link";

import type { BoostPaymentMethod } from "@/types/boost.type";
import type { PaymentOptionState } from "@/utils/adsHub.util";

import styles from "./adsHub.module.css";

const VERIFY_PAYOUTS_HREF = "/wallet/payouts#payout-accounts";
const VERIFICATION_REASON_CODES = new Set(["VERIFICATION_REQUIRED"]);

interface AdPaymentPickerProps {
  readonly states: readonly PaymentOptionState[];
  readonly reasonCodes: Readonly<Partial<Record<BoostPaymentMethod, string | null>>>;
  readonly selected: BoostPaymentMethod | null;
  readonly onSelect: (method: BoostPaymentMethod) => void;
  readonly label?: string;
}

export function AdPaymentPicker({ states, reasonCodes, selected, onSelect, label = "Pay with" }: AdPaymentPickerProps) {
  return (
    <section className={styles.section} aria-label={label}>
      <h2 className={styles.sectionTitle}>{label}</h2>
      <div className={styles.options} role="radiogroup" aria-label={label}>
        {states.map((state) => {
          const isSelected = selected === state.method;
          const needsVerification = VERIFICATION_REASON_CODES.has(reasonCodes[state.method] ?? "");
          return (
            <div key={state.method} className={styles.section}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={!state.selectable}
                disabled={!state.selectable}
                className={[styles.option, isSelected ? styles.optionSelected : ""].filter(Boolean).join(" ")}
                onClick={() => onSelect(state.method)}
              >
                <span className={styles.optionTitle}>{state.label}</span>
                {state.note ? <span className={styles.optionHint}>{state.note}</span> : null}
              </button>
              {needsVerification ? <Link className={styles.quietLink} href={VERIFY_PAYOUTS_HREF}>Verify payouts</Link> : null}
            </div>
          );
        })}
      </div>
      <p className={styles.note}>Prices are worked out by Zudomart before you pay. Your ad is reviewed before it runs.</p>
    </section>
  );
}
