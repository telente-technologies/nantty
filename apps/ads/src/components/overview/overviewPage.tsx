"use client";

import { useState } from "react";

import { LineChart } from "@/components/charts/lineChart";
import { KpiTileGrid, type KpiTile } from "@/components/overview/kpiTileGrid";
import { NeedsAttentionPanel } from "@/components/overview/needsAttentionPanel";
import { TopCampaignsTable } from "@/components/overview/topCampaignsTable";
import { buildAxisValueFormatterForMetric, convertSeriesToLineChartPoints, describeMetricChangeAgainstComparison } from "@/components/reports/reportChartData.util";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl, SwitchToggle } from "@/components/ui/formFields";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { findMetricDefinition } from "@/constants/reportOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import { reportsApi } from "@/services/reportsApi.service";
import type { MetricKey, ReportMetrics } from "@/types/report.type";
import { buildDateRangeFromPreset, buildPreviousPeriodForComparison, formatDateRangeForDisplay } from "@/utils/dateRange.util";
import { calculatePercentChange, formatMetricValueForDisplay, formatPercentFromRatio, formatWholeCount } from "@/utils/numberFormatting.util";

import styles from "./overviewPage.module.css";

type OverviewRangePreset = "last_7_days" | "last_14_days" | "last_30_days";
type ChartMetric = Extract<MetricKey, "spend" | "impressions" | "clicks" | "conversions">;

const rangeOptions: { value: OverviewRangePreset; label: string }[] = [
  { value: "last_7_days", label: "7 days" },
  { value: "last_14_days", label: "14 days" },
  { value: "last_30_days", label: "30 days" },
];
const chartMetricOptions: { value: ChartMetric; label: string }[] = [
  { value: "spend", label: "Spend" },
  { value: "impressions", label: "Impressions" },
  { value: "clicks", label: "Clicks" },
  { value: "conversions", label: "Purchases" },
];
const kpiMetricKeys: MetricKey[] = ["spend", "reach", "clicks", "ctr", "cpc", "conversions", "roas"];

function buildKpiTiles(totals: ReportMetrics | null, previous: ReportMetrics | null, results: number, previousResults: number | null): KpiTile[] {
  const resultsChange = previousResults === null ? null : calculatePercentChange(results, previousResults);
  const resultsTile: KpiTile = {
    key: "results",
    label: "Results",
    value: formatWholeCount(results),
    delta: previousResults === null ? null : { change: resultsChange, tone: resultsChange === null || Math.abs(resultsChange) < 0.005 ? "neutral" : resultsChange > 0 ? "better" : "worse", label: resultsChange === null ? "No earlier data" : `${resultsChange > 0 ? "+" : ""}${formatPercentFromRatio(resultsChange, 1)}` },
    hint: "Summed across objectives",
  };
  const metricTiles = kpiMetricKeys.map((key) => ({ key, label: findMetricDefinition(key).label, value: totals ? formatMetricValueForDisplay(totals, key) : "—", delta: totals ? describeMetricChangeAgainstComparison(key, totals, previous) : null }));
  return [metricTiles[0] as KpiTile, resultsTile, ...metricTiles.slice(1)];
}

export function OverviewPage() {
  const { accountId, account, currency, canPerform, buildAccountPagePath } = useAdAccount();
  const [rangePreset, setRangePreset] = useState<OverviewRangePreset>("last_7_days");
  const [isComparing, setIsComparing] = useState(true);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("spend");
  const range = buildDateRangeFromPreset(rangePreset);
  const previousRange = buildPreviousPeriodForComparison(range);
  const queryKey = `${accountId}-${range.from}-${range.to}-${isComparing}`;

  const reportQuery = useAdsQuery(
    (signal) => reportsApi.fetchReport(accountId, { from: range.from, to: range.to, compareFrom: isComparing ? previousRange.from : null, compareTo: isComparing ? previousRange.to : null, breakdown: "campaign", campaignIds: [], clickWindowDays: 7, viewWindowDays: 1 }, signal),
    queryKey,
  );
  const campaignsQuery = useAdsQuery(() => campaignsApi.listCampaigns(accountId, { from: range.from, to: range.to }), `campaigns-${queryKey}`);
  const previousCampaignsQuery = useAdsQuery(() => campaignsApi.listCampaigns(accountId, { from: previousRange.from, to: previousRange.to }), `previous-campaigns-${queryKey}`, isComparing);

  const report = reportQuery.data;
  const campaigns = campaignsQuery.data?.items ?? [];
  const results = campaigns.reduce((total, campaign) => total + campaign.delivery.results, 0);
  const previousResults = isComparing && previousCampaignsQuery.data ? previousCampaignsQuery.data.items.reduce((total, campaign) => total + campaign.delivery.results, 0) : null;
  const topCampaigns = [...campaigns].filter((campaign) => campaign.delivery.spend.amountMinor > 0).sort((first, second) => second.delivery.spend.amountMinor - first.delivery.spend.amountMinor).slice(0, 5);
  const chartDefinition = findMetricDefinition(chartMetric);

  return (
    <>
      <PageHeader
        eyebrow={account.kind === "business" ? "Business ad account" : "Personal ad account"}
        title="Overview"
        description={`How your ads delivered ${formatDateRangeForDisplay(range)}.`}
        actions={
          <>
            <ButtonLink href={buildAccountPagePath(`/reports?from=${range.from}&to=${range.to}`)} iconName="arrowUpRight24">
              Open reports
            </ButtonLink>
            {canPerform("campaigns:manage") ? (
              <ButtonLink href={buildAccountPagePath("/campaigns/new")} variant="primary" iconName="plus16">
                Create campaign
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <div className={styles.controls}>
        <SegmentedControl label="Date range" value={rangePreset} onValueChange={setRangePreset} options={rangeOptions} />
        <SwitchToggle label="Compare with previous period" checked={isComparing} onCheckedChange={setIsComparing} />
      </div>
      {reportQuery.errorMessage ? <ErrorState error={reportQuery.error} message={reportQuery.errorMessage} onRetry={reportQuery.reload} /> : null}
      <KpiTileGrid tiles={buildKpiTiles(report?.totals ?? null, report?.comparisonTotals ?? null, results, previousResults)} isLoading={reportQuery.isLoading && !report} />
      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <Card title={`${chartDefinition.label} by day`} actions={<SegmentedControl label="Chart metric" value={chartMetric} onValueChange={setChartMetric} options={chartMetricOptions} />}>
            {report ? (
              <LineChart
                title={`${chartDefinition.label} by day`}
                description={`Daily ${chartDefinition.label.toLowerCase()} for ${formatDateRangeForDisplay(range)}${isComparing ? ", with the previous period as a dashed line" : ""}.`}
                seriesLabel={formatDateRangeForDisplay(range)}
                points={convertSeriesToLineChartPoints(report.series, chartMetric)}
                comparisonLabel={isComparing ? "Previous period" : undefined}
                comparisonPoints={isComparing ? convertSeriesToLineChartPoints(report.comparisonSeries, chartMetric) : undefined}
                formatAxisValue={buildAxisValueFormatterForMetric(chartMetric, currency)}
              />
            ) : (
              <LoadingBlock label="Loading chart" height={240} />
            )}
          </Card>
          <Card title="Top campaigns" description="By spend in this period." padded={false} actions={<ButtonLink href={buildAccountPagePath("/campaigns")} size="small" variant="ghost">All campaigns</ButtonLink>}>
            {campaignsQuery.isLoading && !campaignsQuery.data ? <LoadingBlock label="Loading campaigns" height={180} /> : <TopCampaignsTable campaigns={topCampaigns} />}
          </Card>
        </div>
        <div className={styles.sideColumn}>
          <NeedsAttentionPanel />
        </div>
      </div>
    </>
  );
}
