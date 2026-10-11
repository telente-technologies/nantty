import type { HostRanking, LiveEarnings } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import styles from "./liveEarningsPanel.module.css";

interface LiveEarningsPanelProps {
  readonly earnings: LiveEarnings;
  readonly viewers: number;
  readonly peakViewers: number;
  readonly ranking?: HostRanking | null;
}

export function LiveEarningsPanel({ earnings, viewers, peakViewers, ranking }: LiveEarningsPanelProps) {
  const metrics = [
    { label: "Coins earned", value: formatCountWithThousandsSuffix(earnings.coins) },
    { label: "Gifts received", value: formatCountWithThousandsSuffix(earnings.giftCount) },
    { label: "Watching now", value: formatCountWithThousandsSuffix(viewers) },
    { label: "Peak viewers", value: formatCountWithThousandsSuffix(peakViewers) },
  ];

  return (
    <section className={styles.panel} aria-label="Gifts and audience">
      <ul className={styles.metrics}>
        {metrics.map((metric) => (
          <li key={metric.label} className={styles.metric}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <span className={styles.metricValue}>{metric.value}</span>
          </li>
        ))}
      </ul>
      <div className={styles.columns}>
        <div>
          <h3 className={styles.heading}>Top gifters</h3>
          {earnings.topGifters.length === 0 ? <p className={styles.muted}>No gifts yet. Ask viewers to tap the gift button; top gifters are listed here as gifts land.</p> : null}
          <ol className={styles.list}>
            {earnings.topGifters.map((gifter, index) => (
              <li key={gifter.id} className={styles.row}>
                <span>
                  {index + 1}. {gifter.name}
                </span>
                <span className={styles.rowValue}>{formatCountWithThousandsSuffix(gifter.coins)} coins</span>
              </li>
            ))}
          </ol>
        </div>
        {ranking ? (
          <div>
            <h3 className={styles.heading}>Your rank ring ({ranking.period})</h3>
            <ul className={styles.list}>
              <li className={styles.row}>
                <span>Global streamers</span>
                <span className={styles.rowValue}>#{ranking.globalRank}</span>
              </li>
              {ranking.categoryRank !== null ? (
                <li className={styles.row}>
                  <span>In {ranking.category ?? "your category"}</span>
                  <span className={styles.rowValue}>#{ranking.categoryRank}</span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
