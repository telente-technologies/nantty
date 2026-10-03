import type { LiveEarnings } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import styles from "./liveEarningsPanel.module.css";

interface LiveEarningsPanelProps {
  readonly earnings: LiveEarnings;
  readonly viewers: number;
  readonly peakViewers: number;
}

export function LiveEarningsPanel({ earnings, viewers, peakViewers }: LiveEarningsPanelProps) {
  const metrics = [
    { label: "Coins earned", value: formatCountWithThousandsSuffix(earnings.coins) },
    { label: "Gifts received", value: formatCountWithThousandsSuffix(earnings.giftCount) },
    { label: "New subscribers", value: formatCountWithThousandsSuffix(earnings.newSubscribers) },
    { label: "Watching now", value: formatCountWithThousandsSuffix(viewers) },
    { label: "Peak viewers", value: formatCountWithThousandsSuffix(peakViewers) },
  ];

  return (
    <section className={styles.panel} aria-label="Earnings and audience">
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
          {earnings.topGifters.length === 0 ? <p className={styles.muted}>No gifts yet. They show up here as they land.</p> : null}
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
        <div>
          <h3 className={styles.heading}>Battle results</h3>
          {earnings.battles.length === 0 ? <p className={styles.muted}>No battles in this live.</p> : null}
          <ul className={styles.list}>
            {earnings.battles.map((battle) => {
              const won = battle.coinsFor >= battle.coinsAgainst;
              return (
                <li key={battle.id} className={styles.row}>
                  <span>
                    <span className={won ? styles.won : styles.lost}>{won ? "Won" : "Lost"}</span> vs {battle.opponentName}
                  </span>
                  <span className={styles.rowValue}>
                    {formatCountWithThousandsSuffix(battle.coinsFor)} to {formatCountWithThousandsSuffix(battle.coinsAgainst)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
