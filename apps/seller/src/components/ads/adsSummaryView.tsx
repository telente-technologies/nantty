"use client";

import { useState } from "react";

import { formatReturnOnAdSpend, AdsCampaignsTable } from "@/components/ads/adsCampaignsTable";
import { PlanLockedNotice } from "@/components/billing/planGate";
import { LineChart } from "@/components/charts/lineChart";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock, StatTile } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { AdsSummary } from "@/types/ads.type";
import { formatShortDateLabel } from "@/utils/chartScale.util";
import { buildDateRangeEndingToday, formatDateForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

import buttonStyles from "@/components/ui/button.module.css";

import styles from "./ads.module.css";

function buildAdsManagerAccountLink(adsManagerUrl: string, pathInsideAccount: string): string {
  return `${adsManagerUrl}/accounts?next=${encodeURIComponent(pathInsideAccount)}`;
}

function AdsManagerLinks({ adsManagerUrl }: { readonly adsManagerUrl: string }) {
  return (
    <>
      <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>
        <ZudoIcon name="arrowUpRight24" size={18} /> Open Ads Manager
      </a>
      <a href={buildAdsManagerAccountLink(adsManagerUrl, "campaigns/new?objective=store_promotion")} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>
        <ZudoIcon name="buildingStore20" size={18} /> Promote store
      </a>
      <a href={buildAdsManagerAccountLink(adsManagerUrl, "campaigns/new")} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>
        <ZudoIcon name="plus16" size={18} /> Create campaign
      </a>
    </>
  );
}

function AdsPerformancePanels() {
  const { formatMoney, formatMoneyCompact, currency, locale } = useMoneyFormatter();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(30));
  const summaryQuery = useSellerQuery<AdsSummary>("/seller/ads/summary", { from: dateRange.from, to: dateRange.to });
  const summary = summaryQuery.data;
  const toMoney = (amountMinor: number) => (currency ? { amountMinor, currency } : null);

  return (
    <>
      <FilterBar>
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
        <Button size="small" variant="ghost" iconName="refresh20" onClick={summaryQuery.reload} isBusy={summaryQuery.isLoading && Boolean(summary)}>Refresh</Button>
      </FilterBar>
      {summaryQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={summaryQuery.reload}>Try again</Button>}>{summaryQuery.errorMessage}</Callout> : null}
      {!summary && summaryQuery.isLoading ? <LoadingBlock label="Loading ad results" /> : null}
      {summary ? (
        <>
          <ResponsiveGrid minimumColumnWidth={160}>
            <StatTile label="Spend" value={formatMoney(summary.totals.spend)} detail={summary.adCreditBalance ? `${formatMoney(summary.adCreditBalance)} credit left` : undefined} />
            <StatTile label="Impressions" value={summary.totals.impressions.toLocaleString(locale)} />
            <StatTile label="Clicks" value={summary.totals.clicks.toLocaleString(locale)} detail={`${formatBasisPointsAsPercent(summary.totals.clickThroughRateBasisPoints)} click-through`} />
            <StatTile label="Attributed orders" value={summary.totals.attributedOrders.toLocaleString(locale)} detail={formatMoney(summary.totals.attributedRevenue)} tone="positive" />
            <StatTile label="Return on ad spend" value={summary.totals.spend.amountMinor > 0 ? formatReturnOnAdSpend(summary.totals.returnOnAdSpendHundredths) : "—"} tone={summary.totals.returnOnAdSpendHundredths >= 100 ? "positive" : "caution"} detail="Revenue ÷ spend" />
          </ResponsiveGrid>
          <Panel title="Spend and attributed revenue" description={`${formatDateForDisplay(`${summary.from}T12:00:00Z`)} – ${formatDateForDisplay(`${summary.to}T12:00:00Z`)} · orders counted within 7 days of an ad click`}>
            <LineChart
              title="Daily ad spend and attributed revenue"
              description="Two lines per day: ad spend in yellow and revenue from orders attributed to ads in blue."
              series={[
                { key: "revenue", label: "Attributed revenue", colorVariable: "--chart-1" },
                { key: "spend", label: "Spend", colorVariable: "--caution" },
              ]}
              points={summary.daily.map((point) => ({ label: formatShortDateLabel(point.date, locale), shortLabel: formatShortDateLabel(point.date, locale), values: { revenue: point.attributedRevenue.amountMinor, spend: point.spend.amountMinor } }))}
              formatValue={(value) => formatMoney(toMoney(value))}
              formatAxisValue={(value) => formatMoneyCompact(toMoney(value))}
            />
          </Panel>
          <Panel title="Campaigns" description="Manage budgets, creatives and targeting in Ads Manager." padded={false}>
            <AdsCampaignsTable campaigns={summary.campaigns} />
          </Panel>
        </>
      ) : null}
    </>
  );
}

function AdsFreePlanTeaser() {
  return (
    <div className={styles.teaser}>
      <PlanLockedNotice feature="ads_tools" description="See spend, impressions, clicks, attributed orders and return on ad spend for every campaign right here, next to your sales. You can already create and run ads in Ads Manager on any plan." />
      <Panel title="What you get on Pro">
        <ul className={styles.teaserList}>
          <li><ZudoIcon name="check16" size={14} /> Spend and revenue trend for any date range</li>
          <li><ZudoIcon name="check16" size={14} /> Orders and revenue attributed to each campaign</li>
          <li><ZudoIcon name="check16" size={14} /> Return on ad spend so you know what to scale</li>
          <li><ZudoIcon name="check16" size={14} /> Ads results inside your downloadable reports</li>
        </ul>
      </Panel>
    </div>
  );
}

export function AdsSummaryView({ adsManagerUrl }: { readonly adsManagerUrl: string }) {
  const { hasFeature } = usePlanFeatures();
  return (
    <PageStack>
      <PageHeader title="Ads" description="How your Zudomart ads are performing. Create and edit campaigns in Ads Manager at ads.zudomart.com." actions={<AdsManagerLinks adsManagerUrl={adsManagerUrl} />} />
      {hasFeature("ads_tools") ? <AdsPerformancePanels /> : <AdsFreePlanTeaser />}
    </PageStack>
  );
}
