import { StatusBadge } from "@/components/ui/statusBadge";
import { SkeletonLine } from "@/components/ui/feedback";
import type { AudienceBreadth, AudienceEstimate } from "@/types/audience.type";
import { formatRangeOfPeople } from "@/utils/numberFormatting.util";

import styles from "./audienceEstimatePanel.module.css";

const breadthPositions: Record<AudienceBreadth, number> = { too_narrow: 8, narrow: 32, balanced: 58, broad: 88 };
const breadthLabels: Record<AudienceBreadth, string> = { too_narrow: "Too narrow", narrow: "Specific", balanced: "Well defined", broad: "Broad" };

interface AudienceEstimatePanelProps {
  readonly estimate: AudienceEstimate | null;
  readonly isEstimating: boolean;
  readonly errorMessage: string | null;
  readonly hasLocations: boolean;
  readonly audienceSummary: string;
}

export function AudienceEstimatePanel({ estimate, isEstimating, errorMessage, hasLocations, audienceSummary }: AudienceEstimatePanelProps) {
  return (
    <section className={styles.estimatePanel} aria-labelledby="estimate-heading" aria-busy={isEstimating}>
      <div className={styles.estimateHeader}>
        <h2 id="estimate-heading">Audience estimate</h2>
        {isEstimating ? <span className={styles.estimatingDot} aria-hidden /> : null}
      </div>
      <p className={styles.estimateSummary}>{audienceSummary}</p>
      {!hasLocations ? <p className={styles.estimateMuted}>Add a location to see how many people you can reach.</p> : null}
      {errorMessage ? <p className={styles.estimateError}>{errorMessage}</p> : null}
      {hasLocations && !estimate && !errorMessage ? (
        <div className={styles.estimateSkeleton}>
          <SkeletonLine width="60%" />
          <SkeletonLine width="80%" />
        </div>
      ) : null}
      {estimate ? (
        <div aria-live="polite" className={styles.estimateBody}>
          <div>
            <p className={styles.estimateLabel}>Estimated audience size</p>
            <p className={`${styles.estimateValue} numeric`}>{formatRangeOfPeople(estimate.audienceSize)}</p>
          </div>
          <div className={styles.gauge} role="img" aria-label={`Audience breadth: ${breadthLabels[estimate.breadth]}`}>
            <div className={styles.gaugeTrack}>
              <span className={styles.gaugeNeedle} style={{ left: `${breadthPositions[estimate.breadth]}%` }} />
            </div>
            <div className={styles.gaugeLabels} aria-hidden>
              <span>Specific</span>
              <span>Broad</span>
            </div>
            <StatusBadge tone={estimate.breadth === "too_narrow" ? "error" : estimate.breadth === "balanced" ? "success" : "info"}>{breadthLabels[estimate.breadth]}</StatusBadge>
          </div>
          <dl className={styles.estimateList}>
            <div>
              <dt>Daily reach</dt>
              <dd className="numeric">{estimate.dailyReach ? formatRangeOfPeople(estimate.dailyReach) : "Add a budget"}</dd>
            </div>
            <div>
              <dt>{estimate.resultLabel} per day</dt>
              <dd className="numeric">{estimate.dailyResults ? formatRangeOfPeople(estimate.dailyResults) : "Add a budget"}</dd>
            </div>
          </dl>
          {estimate.warnings.length > 0 ? (
            <ul className={styles.estimateWarnings}>
              {estimate.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <p className={styles.estimateMuted}>Estimates are not guarantees. They depend on the auction, your ad quality and budget.</p>
        </div>
      ) : null}
    </section>
  );
}
