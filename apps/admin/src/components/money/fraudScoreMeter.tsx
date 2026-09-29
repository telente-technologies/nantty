import type { FraudAssessment } from "@/types/payouts.type";

import styles from "./money.module.css";

const colorByRisk = { LOW: "var(--success)", MEDIUM: "var(--caution)", HIGH: "var(--error)" } as const;

export function FraudScoreMeter({ fraud }: { readonly fraud: Pick<FraudAssessment, "score" | "riskLevel"> }) {
  return (
    <span className={styles.meter} title={`Fraud score ${fraud.score} of 100 (${fraud.riskLevel.toLowerCase()} risk)`}>
      <span className={styles.meterTrack} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fraud.score} aria-label="Fraud score">
        <span className={styles.meterFill} style={{ width: `${fraud.score}%`, background: colorByRisk[fraud.riskLevel] }} />
      </span>
      <span className={styles.meterValue}>{fraud.score}</span>
    </span>
  );
}
