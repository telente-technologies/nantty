"use client";

import { useState } from "react";

import { DashboardBalancesPanel, DashboardLowStockPanel, DashboardOrdersByStatusPanel, DashboardRecentActivityPanel, DashboardTopProductsPanel } from "@/components/dashboard/dashboardOperationsPanels";
import { DashboardChannelSplitPanel, DashboardRevenueChartPanel, DashboardSalesKpiRow } from "@/components/dashboard/dashboardSalesPanels";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/navigationTabs";
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
  const { selectedLocationId, locations, settings } = useStoreContext();
  const [scope, setScope] = useState<"all" | "location">("all");
  const scopedLocationId = scope === "location" && selectedLocationId ? selectedLocationId : "all";
  const summaryQuery = useSellerQuery<DashboardSummary>("/seller/dashboard", { locationId: scopedLocationId });
  const selectedLocationName = locations.find((location) => location.id === selectedLocationId)?.name;
  const firstName = (sessionView?.operator?.name ?? sessionView?.user.name ?? "").split(" ")[0];
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
          {selectedLocationName ? (
            <SegmentedControl
              label="Dashboard scope"
              value={scope}
              onValueChange={setScope}
              options={[
                { value: "all", label: "All locations" },
                { value: "location", label: selectedLocationName },
              ]}
            />
          ) : null}
          <Button size="small" variant="ghost" iconName="refresh20" onClick={summaryQuery.reload} isBusy={summaryQuery.isLoading && Boolean(summary)}>
            Refresh
          </Button>
          {can("pos:sell") ? (
            <ButtonLink href="/pos" variant="primary" iconName="shoppingCart24">
              Open register
            </ButtonLink>
          ) : null}
          {can("products:manage") ? (
            <ButtonLink href="/products/new" iconName="plus16">
              Add product
            </ButtonLink>
          ) : null}
        </div>
      </header>
      {scope === "location" ? <Callout tone="info">Online orders are not tied to a shop, so they still count in this view. Register sales and stock are for {selectedLocationName} only.</Callout> : null}
      {summaryQuery.errorMessage && !summary ? (
        <Callout tone="error" title="The dashboard could not load" action={<Button size="small" onClick={summaryQuery.reload}>Try again</Button>}>
          {summaryQuery.errorMessage}
        </Callout>
      ) : null}
      {!summary && summaryQuery.isLoading ? <LoadingBlock label="Loading your numbers" /> : null}
      {summary ? (
        <>
          <DashboardSalesKpiRow summary={summary} />
          <div className={styles.mainGrid}>
            <div className={styles.mainStack}>
              <DashboardRevenueChartPanel summary={summary} />
              <DashboardOrdersByStatusPanel summary={summary} />
              <DashboardRecentActivityPanel summary={summary} />
            </div>
            <div className={styles.sideStack}>
              {can("wallet:view") ? <DashboardBalancesPanel summary={summary} /> : null}
              <DashboardChannelSplitPanel summary={summary} />
              <DashboardTopProductsPanel summary={summary} />
              <DashboardLowStockPanel summary={summary} />
            </div>
          </div>
        </>
      ) : null}
    </PageStack>
  );
}
