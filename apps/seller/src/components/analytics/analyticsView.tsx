"use client";

import { useState } from "react";

import { AnalyticsLockedBreakdowns, AnalyticsUnlockedBreakdowns } from "@/components/analytics/analyticsBreakdownSections";
import { AnalyticsKpiTiles, AnalyticsNetSalesBreakdownPanel, AnalyticsSalesChartPanel } from "@/components/analytics/analyticsKpiPanels";
import { countDaysInDateRange } from "@/components/analytics/analyticsLabels.util";
import { PlanLockedNotice } from "@/components/billing/planGate";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { DateRangeControl, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { AnalyticsOverview } from "@/types/analytics.type";
import { buildDateRangeEndingToday, formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./analytics.module.css";

export function AnalyticsView() {
  const { hasFeature, limits } = usePlanFeatures();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(30));
  const overviewQuery = useSellerQuery<AnalyticsOverview>("/seller/analytics/overview", { from: dateRange.from, to: dateRange.to });
  const overview = overviewQuery.data;
  const hasAdvancedAnalytics = hasFeature("advanced_analytics");
  const isRangeBeyondPlanHistory = countDaysInDateRange(dateRange.from, dateRange.to) > limits.analyticsHistoryDays;

  return (
    <PageStack>
      <PageHeader title="Sales & analytics" description="How your app orders, buyers and products are performing. Net sales are gross sales minus refunds and Nantty fees." />
      <div className={styles.toolbar}>
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
        <Button size="small" variant="ghost" iconName="refresh20" onClick={overviewQuery.reload} isBusy={overviewQuery.isLoading && Boolean(overview)}>
          Refresh
        </Button>
      </div>
      {isRangeBeyondPlanHistory && !hasAdvancedAnalytics ? (
        <PlanLockedNotice compact feature="advanced_analytics" description={`Your plan shows the last ${limits.analyticsHistoryDays} days. Upgrade to compare up to 12 months.`} />
      ) : null}
      {overview?.historyLimitedToDays && hasAdvancedAnalytics ? (
        <Callout tone="info">Showing {formatDateForDisplay(`${overview.from}T12:00:00.000Z`)} onwards — your plan keeps {overview.historyLimitedToDays} days of history.</Callout>
      ) : null}
      {overviewQuery.errorMessage && !overview ? (
        <Callout tone="error" title="Analytics could not load" action={<Button size="small" onClick={overviewQuery.reload}>Try again</Button>}>
          {overviewQuery.errorMessage}
        </Callout>
      ) : null}
      {!overview && overviewQuery.isLoading ? <LoadingBlock label="Crunching your numbers" /> : null}
      {overview ? (
        <>
          <AnalyticsKpiTiles overview={overview} />
          <div className={styles.chartGrid}>
            <AnalyticsSalesChartPanel overview={overview} />
            <AnalyticsNetSalesBreakdownPanel overview={overview} />
          </div>
        </>
      ) : null}
      {hasAdvancedAnalytics ? <AnalyticsUnlockedBreakdowns from={dateRange.from} to={dateRange.to} /> : <AnalyticsLockedBreakdowns />}
    </PageStack>
  );
}
