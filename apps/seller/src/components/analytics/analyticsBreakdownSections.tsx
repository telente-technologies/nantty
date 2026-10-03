"use client";

import { AnalyticsBestProductsPanel, AnalyticsSlowProductsPanel } from "@/components/analytics/analyticsProductTables";
import { AnalyticsCategoryPanel, AnalyticsLocationPanel, AnalyticsRefundsPanel, AnalyticsTimePanel } from "@/components/analytics/analyticsSegmentPanels";
import { PlanLockedNotice } from "@/components/billing/planGate";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { AnalyticsBreakdowns } from "@/types/analytics.type";

import styles from "./analytics.module.css";

export function AnalyticsLockedBreakdowns() {
  return (
    <div className={styles.twoColumns}>
      <PlanLockedNotice feature="advanced_analytics" description="See your best sellers and slow movers with views and conversion for each product." />
      <PlanLockedNotice feature="advanced_analytics" description="Break sales down by category, buyer state and city, and hour of the day." />
      <PlanLockedNotice feature="advanced_analytics" description="Track every refund with its reason, and compare ranges up to 12 months." />
    </div>
  );
}

export function AnalyticsUnlockedBreakdowns({ from, to }: { readonly from: string; readonly to: string }) {
  const breakdownsQuery = useSellerQuery<AnalyticsBreakdowns>("/seller/analytics/breakdowns", { from, to });
  const breakdowns = breakdownsQuery.data;
  if (breakdownsQuery.errorMessage && !breakdowns) {
    return (
      <Callout tone="error" title="Breakdowns could not load" action={<Button size="small" onClick={breakdownsQuery.reload}>Try again</Button>}>
        {breakdownsQuery.errorMessage}
      </Callout>
    );
  }
  if (!breakdowns) return <LoadingBlock label="Loading breakdowns" />;
  return (
    <>
      <div className={styles.twoColumns}>
        <AnalyticsBestProductsPanel rows={breakdowns.bestProducts} />
        <AnalyticsSlowProductsPanel rows={breakdowns.slowProducts} />
      </div>
      <div className={styles.twoColumns}>
        <AnalyticsCategoryPanel breakdowns={breakdowns} />
        <AnalyticsLocationPanel breakdowns={breakdowns} />
      </div>
      <div className={styles.twoColumns}>
        <AnalyticsTimePanel breakdowns={breakdowns} />
        <AnalyticsRefundsPanel breakdowns={breakdowns} />
      </div>
    </>
  );
}
