import type { DataTableColumn } from "@/components/ui/dataTable";
import type { DeliverySummary } from "@/types/campaign.type";
import type { Money } from "@/types/money.type";
import { formatMoneyForDisplay } from "@/utils/money.util";
import { formatPercentFromRatio, formatWholeCount } from "@/utils/numberFormatting.util";

import styles from "./campaignTables.module.css";

function sumMoneyAcrossRows(amounts: readonly Money[]): Money | null {
  const firstAmount = amounts[0];
  if (!firstAmount) return null;
  if (amounts.some((amount) => amount.currency !== firstAmount.currency)) return null;
  return { amountMinor: amounts.reduce((total, amount) => total + amount.amountMinor, 0), currency: firstAmount.currency };
}

function divideMoneyByCount(money: Money, count: number): Money | null {
  return count > 0 ? { amountMinor: Math.round(money.amountMinor / count), currency: money.currency } : null;
}

function calculateClickThroughRate(delivery: DeliverySummary): number | null {
  return delivery.impressions > 0 ? delivery.clicks / delivery.impressions : null;
}

function calculateReturnOnAdSpend(delivery: DeliverySummary): number | null {
  return delivery.spend.amountMinor > 0 && delivery.conversionValue.amountMinor > 0 ? delivery.conversionValue.amountMinor / delivery.spend.amountMinor : null;
}

export function buildDeliveryMetricColumns<Row>(rows: readonly Row[], readDelivery: (row: Row) => DeliverySummary, readResultLabel: (row: Row) => string): DataTableColumn<Row>[] {
  const deliveries = rows.map(readDelivery);
  const totalSpend = sumMoneyAcrossRows(deliveries.map((delivery) => delivery.spend));
  const totalConversionValue = sumMoneyAcrossRows(deliveries.map((delivery) => delivery.conversionValue));
  const totalImpressions = deliveries.reduce((total, delivery) => total + delivery.impressions, 0);
  const totalClicks = deliveries.reduce((total, delivery) => total + delivery.clicks, 0);
  const totalReach = deliveries.reduce((total, delivery) => total + delivery.reach, 0);
  return [
    {
      key: "results",
      header: "Results",
      align: "end",
      sortValue: (row) => readDelivery(row).results,
      render: (row) => (
        <span className={styles.stackedCell}>
          <span>{formatWholeCount(readDelivery(row).results)}</span>
          <span className={styles.subtle}>{readResultLabel(row)}</span>
        </span>
      ),
    },
    { key: "costPerResult", header: "Cost per result", align: "end", sortValue: (row) => readDelivery(row).costPerResult?.amountMinor ?? null, render: (row) => formatMoneyForDisplay(readDelivery(row).costPerResult) },
    { key: "spend", header: "Amount spent", align: "end", sortValue: (row) => readDelivery(row).spend.amountMinor, render: (row) => formatMoneyForDisplay(readDelivery(row).spend), footer: formatMoneyForDisplay(totalSpend) },
    { key: "impressions", header: "Impressions", align: "end", sortValue: (row) => readDelivery(row).impressions, render: (row) => formatWholeCount(readDelivery(row).impressions), footer: formatWholeCount(totalImpressions) },
    { key: "reach", header: "Reach", align: "end", sortValue: (row) => readDelivery(row).reach, render: (row) => formatWholeCount(readDelivery(row).reach), footer: <span title="People can be counted in more than one row, so this is an upper bound.">≤ {formatWholeCount(totalReach)}</span> },
    { key: "clicks", header: "Clicks", align: "end", sortValue: (row) => readDelivery(row).clicks, render: (row) => formatWholeCount(readDelivery(row).clicks), footer: formatWholeCount(totalClicks) },
    { key: "ctr", header: "CTR", align: "end", sortValue: (row) => calculateClickThroughRate(readDelivery(row)), render: (row) => formatPercentFromRatio(calculateClickThroughRate(readDelivery(row))), footer: formatPercentFromRatio(totalImpressions > 0 ? totalClicks / totalImpressions : null) },
    {
      key: "cpc",
      header: "CPC",
      align: "end",
      isHiddenByDefault: true,
      sortValue: (row) => divideMoneyByCount(readDelivery(row).spend, readDelivery(row).clicks)?.amountMinor ?? null,
      render: (row) => formatMoneyForDisplay(divideMoneyByCount(readDelivery(row).spend, readDelivery(row).clicks)),
      footer: totalSpend ? formatMoneyForDisplay(divideMoneyByCount(totalSpend, totalClicks)) : "—",
    },
    {
      key: "cpm",
      header: "CPM",
      align: "end",
      isHiddenByDefault: true,
      sortValue: (row) => divideMoneyByCount(readDelivery(row).spend, readDelivery(row).impressions / 1000)?.amountMinor ?? null,
      render: (row) => formatMoneyForDisplay(divideMoneyByCount(readDelivery(row).spend, readDelivery(row).impressions / 1000)),
      footer: totalSpend ? formatMoneyForDisplay(divideMoneyByCount(totalSpend, totalImpressions / 1000)) : "—",
    },
    { key: "conversionValue", header: "Sales value", align: "end", isHiddenByDefault: true, sortValue: (row) => readDelivery(row).conversionValue.amountMinor, render: (row) => formatMoneyForDisplay(readDelivery(row).conversionValue), footer: formatMoneyForDisplay(totalConversionValue) },
    {
      key: "roas",
      header: "ROAS",
      align: "end",
      isHiddenByDefault: true,
      sortValue: (row) => calculateReturnOnAdSpend(readDelivery(row)),
      render: (row) => {
        const roas = calculateReturnOnAdSpend(readDelivery(row));
        return roas === null ? "—" : `${roas.toFixed(2)}×`;
      },
      footer: totalSpend && totalConversionValue && totalSpend.amountMinor > 0 ? `${(totalConversionValue.amountMinor / totalSpend.amountMinor).toFixed(2)}×` : "—",
    },
  ];
}
