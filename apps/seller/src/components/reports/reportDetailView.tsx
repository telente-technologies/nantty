"use client";

import Link from "next/link";
import { useState } from "react";

import { PlanLockedNotice } from "@/components/billing/planGate";
import { ReportExportActions } from "@/components/reports/reportExportActions";
import { ReportResultChart } from "@/components/reports/reportResultChart";
import { ReportResultTable } from "@/components/reports/reportResultTable";
import { StatTile } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import type { ReportCatalogEntry } from "@/constants/reportCatalog.constant";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { ReportResult } from "@/types/report.type";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import { isMoneyCellValue } from "./reportCellFormatting.util";
import styles from "./reports.module.css";
import { IconLabel } from "@/components/ui/nanttyIcon";

function ReportBackLink() {
  return (
    <Link href="/reports" className={`${styles.backLink} noPrint`}>
      <IconLabel name="arrowLeft24" size={16}>All reports</IconLabel>
    </Link>
  );
}

function ReportDetailLoadedView({ catalogEntry }: { readonly catalogEntry: ReportCatalogEntry }) {
  const { locations, settings } = useStoreContext();
  const { formatMoney, currency, locale } = useMoneyFormatter();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(30));
  const [locationId, setLocationId] = useState("all");
  const reportQueryParameters: Record<string, string> = { ...(catalogEntry.usesDateRange ? { from: dateRange.from, to: dateRange.to } : {}), ...(catalogEntry.supportsLocationFilter ? { locationId } : {}) };
  const reportQuery = useSellerQuery<ReportResult>(`/seller/reports/${catalogEntry.kind}`, reportQueryParameters);
  const report = reportQuery.data;
  const timeZone = settings?.timezone ?? "UTC";
  const moneyTotals = report?.totals ? report.columns.filter((column) => column.kind === "money" && isMoneyCellValue(report.totals?.[column.key] ?? null)).slice(0, 4) : [];

  return (
    <PageStack>
      <ReportBackLink />
      <PageHeader title={catalogEntry.title} description={catalogEntry.description} actions={<ReportExportActions report={report} reportQueryParameters={reportQueryParameters} usesDateRange={catalogEntry.usesDateRange} currency={currency} />} />
      <p className={styles.printOnly}>
        {settings?.name ?? "Your store"} · {catalogEntry.usesDateRange ? `${dateRange.from} to ${dateRange.to}` : "As of today"}
        {report ? ` · generated ${formatDateTimeForDisplay(report.generatedAt, locale, timeZone)}` : ""}
      </p>
      {catalogEntry.usesDateRange || (catalogEntry.supportsLocationFilter && locations.length > 1) ? (
        <div className={`${styles.filters} noPrint`}>
          <FilterBar>
            {catalogEntry.usesDateRange ? <DateRangeControl value={dateRange} onValueChange={setDateRange} /> : null}
            {catalogEntry.supportsLocationFilter && locations.length > 1 ? (
              <label>
                <span className="visuallyHidden">Fulfilment location</span>
                <select className={styles.filterSelect} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="all">All locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </FilterBar>
        </div>
      ) : null}
      {moneyTotals.length > 0 && report?.totals ? (
        <div className={styles.summaryTiles}>
          {moneyTotals.map((column) => {
            const value = report.totals?.[column.key] ?? null;
            return <StatTile key={column.key} label={column.label} value={isMoneyCellValue(value) ? formatMoney(value) : "—"} />;
          })}
        </div>
      ) : null}
      {report && catalogEntry.chart && report.rows.length > 0 ? (
        <Panel title={catalogEntry.chart === "daily-revenue" ? "Revenue per day" : "Top entries"}>
          <ReportResultChart catalogEntry={catalogEntry} report={report} timeZone={timeZone} />
        </Panel>
      ) : null}
      <Panel padded={false} title={report ? `${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"}` : "Results"} description="Select a column heading to sort.">
        <ReportResultTable caption={catalogEntry.title} report={report} isLoading={reportQuery.isLoading} errorMessage={reportQuery.errorMessage} onRetry={reportQuery.reload} locale={locale} timeZone={timeZone} />
      </Panel>
    </PageStack>
  );
}

export function ReportDetailView({ catalogEntry }: { readonly catalogEntry: ReportCatalogEntry }) {
  const { hasFeature } = usePlanFeatures();
  if (catalogEntry.needsAdvancedReports && !hasFeature("advanced_reports")) {
    return (
      <PageStack>
        <ReportBackLink />
        <PageHeader title={catalogEntry.title} description={catalogEntry.description} />
        <PlanLockedNotice feature="advanced_reports" description={`${catalogEntry.title} is part of advanced reports. Upgrade to Pro to see it and export every report to CSV, Excel and PDF.`} />
      </PageStack>
    );
  }
  return <ReportDetailLoadedView catalogEntry={catalogEntry} />;
}
