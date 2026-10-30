"use client";

import { useEffect, useState } from "react";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import { LocalCurrencySymbol } from "../ui/localCurrencySymbol";
import styles from "./escrowReceiptDemo.module.css";

const escrowStages = [
  { label: "Payment received", detail: "A supported payment method starts the order-protection flow." },
  { label: "Held by payment partner", detail: "For eligible Nigerian orders, funds stay in the buyer’s payment-partner account. Nantty does not hold the money." },
  { label: "Out for delivery", detail: "The buyer can track delivery and raise an issue if something changes." },
  { label: "Released to seller", detail: "After delivery confirmation or dispute review, the payment partner releases eligible funds under the order policy." },
] as const;

const confirmDeliveryStageIndex = 2;
const releasedStageIndex = 3;
const automaticAdvanceDelayInMilliseconds = 1800;

function userPrefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InteractiveEscrowReceiptDemo() {
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  useEffect(() => {
    if (userPrefersReducedMotion()) {
      setActiveStageIndex(confirmDeliveryStageIndex);
      return;
    }
    if (activeStageIndex >= confirmDeliveryStageIndex) return;
    const advanceTimer = window.setTimeout(() => setActiveStageIndex((stageIndex) => stageIndex + 1), automaticAdvanceDelayInMilliseconds);
    return () => window.clearTimeout(advanceTimer);
  }, [activeStageIndex]);

  const isAwaitingBuyerConfirmation = activeStageIndex === confirmDeliveryStageIndex;
  const isReleased = activeStageIndex === releasedStageIndex;

  return (
    <figure className={styles.receipt} aria-labelledby="escrow-receipt-caption">
      <div className={styles.receiptHeader}>
        <p className={styles.receiptLabel}>Illustrative example · not a live order</p>
        <p className={`${styles.statusBadge} ${isReleased ? styles.statusReleased : styles.statusHeld}`}>{isReleased ? "Paid out" : "Protected"}</p>
      </div>
      <div className={styles.amountRow}>
        <span className={styles.currencyCoin}>
          <LocalCurrencySymbol />
        </span>
        <p className={styles.amount}>{isReleased ? "Seller paid" : "Payment on hold"}</p>
      </div>
      <p className={styles.orderSummary}>2 items · 1 seller · Home delivery</p>
      <div className={styles.perforation} aria-hidden="true" />
      <ol className={styles.stageList} aria-live="polite">
        {escrowStages.map((escrowStage, stageIndex) => {
          const stageState = stageIndex < activeStageIndex ? "done" : stageIndex === activeStageIndex ? "current" : "upcoming";
          return (
            <li key={escrowStage.label} className={`${styles.stage} ${styles[stageState]}`} aria-current={stageState === "current" ? "step" : undefined}>
              <span className={styles.stageMarker} aria-hidden="true">
                {stageState === "done" ? <FigmaIconTintedWithCurrentColor name="check16" size={14} /> : null}
              </span>
              <span className={styles.stageText}>
                <span className={styles.stageLabel}>{escrowStage.label}</span>
                {stageState !== "upcoming" ? <span className={styles.stageDetail}>{escrowStage.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className={styles.actions}>
        {isAwaitingBuyerConfirmation ? (
          <button type="button" className={styles.confirmButton} onClick={() => setActiveStageIndex(releasedStageIndex)}>
            Confirm delivery
          </button>
        ) : null}
        {isReleased ? (
          <button type="button" className={styles.replayButton} onClick={() => setActiveStageIndex(0)}>
            <FigmaIconTintedWithCurrentColor name="refresh20" size={18} />
            Replay the order
          </button>
        ) : null}
        {!isAwaitingBuyerConfirmation && !isReleased ? <p className={styles.waitingNote}>The seller is not paid yet.</p> : null}
      </div>
      <figcaption id="escrow-receipt-caption" className="visuallyHidden">
        Illustrative, non-live example of the planned payment-partner protection flow for eligible orders. Nantty does not hold customer funds.
      </figcaption>
    </figure>
  );
}
