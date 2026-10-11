"use client";

import { useState } from "react";

import { Card } from "@/components/ui/surfaces";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { KpiTile, Sparkline } from "@/components/ui/kpiTile";
import { MoneyByCurrencyList } from "@/components/ui/moneyByCurrencyList";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchOverviewMetrics } from "@/services/platformApi.service";
import type { MetricsRange } from "@/types/metrics.type";
import { formatDateTime, formatWholeNumber } from "@/utils/formatting.util";

import { AttentionQueueBoard } from "./attentionQueueBoard";
import styles from "./overviewWorkspace.module.css";

const rangeTabs = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;

export function OverviewWorkspace() {
  const [range, setRange] = useState<MetricsRange>("24h");
  const { data: metrics, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchOverviewMetrics(range, signal), range);

  return (
    <>
      <PageHeader area="Platform" title="Overview" description="Health of Zudomart right now and the queues that need a person." meta={metrics ? <span className={styles.generated}>Updated {formatDateTime(metrics.generatedAt)}</span> : null} actions={<SegmentedTabs label="Time range" items={rangeTabs} activeKey={range} onChange={setRange} />} />
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !metrics ? <LoadingBlock lines={6} /> : null}
      {metrics ? (
        <div className={styles.layout}>
          <Card title="Needs attention">
            <AttentionQueueBoard queues={metrics.queues} />
          </Card>
          <div className={styles.kpis}>
            <KpiTile label="Users" value={formatWholeNumber(metrics.users.total)} detail={<span>+{formatWholeNumber(metrics.users.newInRange)} new · {formatWholeNumber(metrics.users.monthlyActive, { compact: true })} monthly active</span>} />
            <KpiTile label="Daily active" value={formatWholeNumber(metrics.users.dailyActive)}>
              <Sparkline values={metrics.users.dailyActiveSeries} label="Daily active users, last 14 days" />
            </KpiTile>
            <KpiTile label="Orders" value={formatWholeNumber(metrics.commerce.ordersInRange)} href="/commerce/orders">
              <Sparkline values={metrics.commerce.ordersSeries} label="Orders per day, last 14 days" />
            </KpiTile>
            <KpiTile label="GMV" value={<MoneyByCurrencyList amounts={metrics.commerce.gmvByCurrency} />} />
            <KpiTile label="Escrow held" value={<MoneyByCurrencyList amounts={metrics.commerce.escrowHeldByCurrency} />} detail={<span>Released in range: <MoneyByCurrencyList amounts={metrics.commerce.escrowReleasedByCurrency.slice(0, 1)} /></span>} />
            <KpiTile label="Disputes open" value={formatWholeNumber(metrics.commerce.disputesOpen)} href="/commerce/disputes" tone={metrics.commerce.disputesOpen > 0 ? "attention" : "default"} />
            <KpiTile label="Reports pending" value={formatWholeNumber(metrics.trust.reportsPending)} href="/moderation/reports" tone={metrics.trust.reportsPending > 0 ? "attention" : "default"} detail={<span>{metrics.trust.appealsPending} appeals · {metrics.trust.copyrightPending} copyright</span>} />
            <KpiTile label="Payouts pending" value={formatWholeNumber(metrics.money.payoutsPendingCount)} href="/commerce/payouts" detail={<MoneyByCurrencyList amounts={metrics.money.payoutsPendingByCurrency} />} />
            <KpiTile label="Ads spend" value={<MoneyByCurrencyList amounts={metrics.money.adsSpendByCurrency} />} />
            <KpiTile label="Creator payouts" value={<MoneyByCurrencyList amounts={metrics.money.creatorPayoutsByCurrency} />} />
          </div>
          <Card title="Service health" isFlush>
            <ul className={styles.health}>
              {metrics.health.map((service) => (
                <li key={service.name}>
                  <StatusBadge status={service.status} />
                  <span className={styles.serviceName}>{service.name}</span>
                  <span className={styles.serviceNote}>{service.note ?? ""}</span>
                  <span className={styles.latency}>{service.latencyMs === null ? "" : `${service.latencyMs} ms`}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
