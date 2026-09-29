"use client";

import type { Money } from "@/types/money.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./pacingMeter.module.css";

function calculateFractionOfLocalDayElapsed(): number {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
}

interface PacingMeterProps {
  readonly spentToday: Money;
  readonly dailyBudget: Money | null;
  readonly isDelivering: boolean;
  readonly isCompact?: boolean;
}

export function PacingMeter({ spentToday, dailyBudget, isDelivering, isCompact = false }: PacingMeterProps) {
  if (!dailyBudget || dailyBudget.amountMinor <= 0) {
    return <span className={styles.noBudget}>{isDelivering ? `${formatMoneyForDisplay(spentToday)} today` : "—"}</span>;
  }
  const spentFraction = Math.min(spentToday.amountMinor / dailyBudget.amountMinor, 1);
  const expectedFraction = isDelivering ? calculateFractionOfLocalDayElapsed() : 0;
  const paceDescription = !isDelivering ? "not delivering" : spentFraction + 0.08 < expectedFraction ? "behind pace" : spentFraction > expectedFraction + 0.12 ? "ahead of pace" : "on pace";
  const valueText = `${formatMoneyForDisplay(spentToday)} of ${formatMoneyForDisplay(dailyBudget)} spent today, ${paceDescription}`;
  return (
    <div className={isCompact ? `${styles.meter} ${styles.compact}` : styles.meter}>
      <div
        className={styles.track}
        role="meter"
        aria-label="Spend today against daily budget"
        aria-valuemin={0}
        aria-valuemax={dailyBudget.amountMinor}
        aria-valuenow={Math.min(spentToday.amountMinor, dailyBudget.amountMinor)}
        aria-valuetext={valueText}
      >
        <span className={styles.fill} style={{ width: `${spentFraction * 100}%` }} />
        {isDelivering ? <span className={styles.expectedTick} style={{ left: `${expectedFraction * 100}%` }} aria-hidden /> : null}
      </div>
      <span className={styles.caption} aria-hidden>
        <span className="numeric">{formatMoneyForDisplay(spentToday, { compact: isCompact })}</span>
        <span className={styles.ofBudget}> / {formatMoneyForDisplay(dailyBudget, { compact: isCompact })}</span>
      </span>
    </div>
  );
}
