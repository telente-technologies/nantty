"use client";

import { AccountHealthCallout } from "@/components/dashboard/accountHealthCallout";
import { BusinessDocumentsBanner } from "@/components/dashboard/businessDocumentsBanner";
import { DashboardActivityFeedPanel, DashboardAlertsPanel, DashboardRecentOrdersPanel } from "@/components/dashboard/dashboardActivityPanels";
import { DashboardInsightTiles } from "@/components/dashboard/dashboardInsightTiles";
import { DashboardLowStockPanel, DashboardOrdersByStatusPanel, DashboardTopProductsPanel } from "@/components/dashboard/dashboardOperationsPanels";
import { DashboardRevenueChartPanel, DashboardSalesKpiRow } from "@/components/dashboard/dashboardSalesPanels";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { PageStack } from "@/components/ui/panel";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { DashboardSummary } from "@/types/dashboard.type";
import { formatTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./dashboard.module.css";

function readGreetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardView() {
  const { sessionView, can } = useSellerSession();
  const { settings } = useStoreContext();
  const summaryQuery = useSellerQuery<DashboardSummary>("/seller/dashboard");
  const firstName = (sessionView?.user.name ?? "").split(" ")[0];
  const storeHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: settings?.timezone ?? "Africa/Lagos" }).format(new Date()));
  const summary = summaryQuery.data;

  return (
    <PageStack>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            {readGreetingForHour(storeHour)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className={styles.subtle}>
            Here is how {sessionView?.access.storeName ?? "your store"} is doing
            {summary ? ` · updated ${formatTimeForDisplay(summary.generatedAt, settings?.locale, settings?.timezone)}` : ""}.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button size="small" variant="ghost" iconName="refresh20" onClick={summaryQuery.reload} isBusy={summaryQuery.isLoading && Boolean(summary)}>
            Refresh
          </Button>
          {can("orders:view") ? (
            <ButtonLink href="/orders?status=new" variant="primary" iconName="shoppingCart24">
              New orders
            </ButtonLink>
          ) : null}
          {can("products:manage") ? (
            <ButtonLink href="/products/new" iconName="plus16">
              Add product
            </ButtonLink>
          ) : null}
        </div>
      </header>
      <BusinessDocumentsBanner />
      <AccountHealthCallout />
      {summaryQuery.errorMessage && !summary ? (
        <Callout tone="error" title="The overview could not load" action={<Button size="small" onClick={summaryQuery.reload}>Try again</Button>}>
          {summaryQuery.errorMessage}
        </Callout>
      ) : null}
      {!summary && summaryQuery.isLoading ? <LoadingBlock label="Loading your numbers" /> : null}
      {summary ? (
        <>
          <DashboardSalesKpiRow summary={summary} />
          <DashboardInsightTiles summary={summary} />
          <div className={styles.mainGrid}>
            <div className={styles.mainStack}>
              <DashboardRevenueChartPanel summary={summary} />
              <DashboardOrdersByStatusPanel summary={summary} />
              <DashboardRecentOrdersPanel summary={summary} />
              <DashboardActivityFeedPanel summary={summary} />
            </div>
            <div className={styles.sideStack}>
              <DashboardAlertsPanel summary={summary} />
              <DashboardTopProductsPanel summary={summary} />
              <DashboardLowStockPanel summary={summary} />
            </div>
          </div>
        </>
      ) : null}
    </PageStack>
  );
}
