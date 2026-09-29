"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StackedBarChart } from "@/components/charts/stackedBarChart";
import { reportTableColumnsFor } from "@/components/reports/reportTableColumns";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, StatTile } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ReportCatalogEntry } from "@/constants/reportCatalog.constant";
import type { ReportCellValue, ReportChannelFilter, ReportResult } from "@/types/report.type";
import { formatShortDateLabel } from "@/utils/chartScale.util";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { buildDateRangeEndingToday } from "@/utils/dateFormatting.util";

import { isMoneyCellValue } from "./reportCellFormatting.util";
import styles from "./reports.module.css";

type ReportRowWithKey = { readonly cells: Record<string, ReportCellValue>; readonly rowKey: string; readonly isTotals: boolean };

export function ReportDetailView({ catalogEntry }: { readonly catalogEntry: ReportCatalogEntry }) {
  const { locations, settings } = useStoreContext();
  const { formatMoney, formatMoneyCompact, currency, locale } = useMoneyFormatter();
  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => buildDateRangeEndingToday(30));
  const [locationId, setLocationId] = useState("all");
  const [channel, setChannel] = useState<ReportChannelFilter>("all");
  const [isExporting, setIsExporting] = useState(false);
  const reportQueryParameters = { ...(catalogEntry.usesDateRange ? { from: dateRange.from, to: dateRange.to } : {}), locationId, ...(catalogEntry.supportsChannelFilter ? { channel } : {}) };
  const reportQuery = useSellerQuery<ReportResult>(`/seller/reports/${catalogEntry.kind}`, reportQueryParameters);
  const report = reportQuery.data;
  const timeZone = settings?.timezone ?? "UTC";

  const tableRows = useMemo<ReportRowWithKey[]>(() => {
    if (!report) return [];
    const rows = report.rows.map((row, index) => ({ cells: row, rowKey: String(index), isTotals: false }));
    return report.totals ? [...rows, { cells: report.totals, rowKey: "totals", isTotals: true }] : rows;
  }, [report]);

  const columns = useMemo(() => (report ? reportTableColumnsFor(report.columns, locale, timeZone, styles.totalsRow ?? "") : []), [report, locale, timeZone]);

  async function downloadReportAsCsv() {
    setIsExporting(true);
    try {
      const csvBlob = await sendSellerApiRequest<Blob>(`/seller/reports/${catalogEntry.kind}`, { query: { ...reportQueryParameters, format: "csv" }, expect: "blob" });
      triggerBrowserDownload(`${catalogEntry.kind}_${catalogEntry.usesDateRange ? `${dateRange.from}_${dateRange.to}` : new Date().toISOString().slice(0, 10)}.csv`, csvBlob);
      showToast("Report downloaded.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExporting(false);
    }
  }

  const moneyTotals = report?.totals ? report.columns.filter((column) => column.kind === "money" && isMoneyCellValue(report.totals?.[column.key] ?? null)).slice(0, 4) : [];

  return (
    <PageStack>
      <Link href="/reports" className={styles.backLink}>
        ← All reports
      </Link>
      <PageHeader
        title={catalogEntry.title}
        description={catalogEntry.description}
        actions={
          <>
            <Button iconName="export24" onClick={() => void downloadReportAsCsv()} isBusy={isExporting} disabled={!report}>
              Export CSV
            </Button>
            <Button variant="ghost" onClick={() => window.print()} disabled={!report}>
              Print
            </Button>
          </>
        }
      />
      <div className={styles.filters}>
        <FilterBar>
          {catalogEntry.usesDateRange ? <DateRangeControl value={dateRange} onValueChange={setDateRange} /> : null}
          <label>
            <span className="visuallyHidden">Location</span>
            <select className={styles.filterSelect} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          {catalogEntry.supportsChannelFilter ? (
            <SegmentedControl label="Sales channel" value={channel} onValueChange={setChannel} options={[{ value: "all", label: "All channels" }, { value: "pos", label: "In store" }, { value: "online", label: "Online" }]} />
          ) : null}
        </FilterBar>
      </div>
      {locationId !== "all" && catalogEntry.supportsChannelFilter && channel === "all" ? <Callout tone="info">Online orders are not tied to a shop, so they are left out when you pick a location. Choose Online to see them.</Callout> : null}
      {reportQuery.errorMessage ? <Callout tone="error" action={<Button size="small" onClick={reportQuery.reload}>Try again</Button>}>{reportQuery.errorMessage}</Callout> : null}
      {moneyTotals.length > 0 && report?.totals ? (
        <div className={styles.summaryTiles}>
          {moneyTotals.map((column) => {
            const value = report.totals?.[column.key] ?? null;
            return <StatTile key={column.key} label={column.label} value={isMoneyCellValue(value) ? formatMoney(value) : "—"} />;
          })}
        </div>
      ) : null}
      {catalogEntry.kind === "sales-by-day" && report && currency ? (
        <Panel title="Revenue per day">
          <StackedBarChart
            title={`Revenue per day from ${report.from} to ${report.to}`}
            description="Stacked bars per day: in-store sales in dark blue and online orders in light blue."
            series={[
              { key: "pos", label: "In store", colorVariable: "--blue-500" },
              { key: "online", label: "Online", colorVariable: "--blue-200" },
            ]}
            points={report.rows.map((row) => ({
              label: String(row.date),
              shortLabel: formatShortDateLabel(String(row.date), locale),
              values: { pos: isMoneyCellValue(row.pos ?? null) ? (row.pos as { amountMinor: number }).amountMinor : 0, online: isMoneyCellValue(row.online ?? null) ? (row.online as { amountMinor: number }).amountMinor : 0 },
            }))}
            formatValue={(value) => formatMoney({ amountMinor: value, currency })}
            formatAxisValue={(value) => formatMoneyCompact({ amountMinor: value, currency })}
          />
        </Panel>
      ) : null}
      <Panel padded={false} title={report ? `${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"}` : "Results"}>
        <DataTable caption={catalogEntry.title} columns={columns} rows={report ? tableRows : null} readRowKey={(row) => row.rowKey} isLoading={reportQuery.isLoading} emptyState="No data for these filters. Try a wider date range." />
      </Panel>
    </PageStack>
  );
}
