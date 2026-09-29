import type { DeliverySummary } from "@/types/campaign.type";
import type { Money } from "@/types/money.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { formatPercentFromRatio, formatWholeCount } from "@/utils/numberFormatting.util";

import { PacingMeter } from "./pacingMeter";
import styles from "./detailPages.module.css";

interface DeliveryKpiStripProps {
  readonly delivery: DeliverySummary;
  readonly resultLabel: string;
  readonly dailyBudget: Money | null;
  readonly isDelivering: boolean;
}

export function DeliveryKpiStrip({ delivery, resultLabel, dailyBudget, isDelivering }: DeliveryKpiStripProps) {
  const tiles = [
    { label: resultLabel, value: formatWholeCount(delivery.results) },
    { label: "Cost per result", value: formatMoneyForDisplay(delivery.costPerResult) },
    { label: "Amount spent", value: formatMoneyForDisplay(delivery.spend) },
    { label: "Impressions", value: formatWholeCount(delivery.impressions) },
    { label: "Reach", value: formatWholeCount(delivery.reach) },
    { label: "Click-through rate", value: formatPercentFromRatio(delivery.impressions > 0 ? delivery.clicks / delivery.impressions : null) },
  ];
  return (
    <dl className={styles.kpiStrip}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.kpiTile}>
          <dt>{tile.label}</dt>
          <dd className="numeric">{tile.value}</dd>
        </div>
      ))}
      <div className={`${styles.kpiTile} ${styles.pacingTile}`}>
        <dt>Today&apos;s pacing</dt>
        <dd>
          <PacingMeter spentToday={delivery.spentToday} dailyBudget={dailyBudget} isDelivering={isDelivering} />
        </dd>
      </div>
    </dl>
  );
}
