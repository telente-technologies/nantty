"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { HorizontalBarChart } from "@/components/charts/horizontalBarChart";
import { LineChart } from "@/components/charts/lineChart";
import { ReportBreakdownTable } from "@/components/reports/reportBreakdownTable";
import { buildAxisValueFormatterForMetric, convertSeriesToLineChartPoints } from "@/components/reports/reportChartData.util";
import { ReportFilters } from "@/components/reports/reportFilters";
import { convertReportViewStateToQuery, readReportViewStateFromSearchParams, writeReportViewStateToSearchParams, type ReportViewState } from "@/components/reports/reportUrlState.util";
import { ScheduledReportsPanel } from "@/components/reports/scheduledReportsPanel";
import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { breakdownOptions, findMetricDefinition, metricDefinitions } from "@/constants/reportOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { readErrorMessageForDisplay, saveBlobAsDownloadedFile } from "@/services/adsApiClient.service";
import { reportsApi } from "@/services/reportsApi.service";
import type { MetricKey } from "@/types/report.type";
import { buildPreviousPeriodForComparison, formatDateRangeForDisplay, formatDateWithYear } from "@/utils/dateRange.util";
import { formatMetricValueForDisplay, readMetricNumericValue } from "@/utils/numberFormatting.util";

import styles from "./reportsPage.module.css";

export function ReportsPage() {
  const { accountId, currency } = useAdAccount();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => readReportViewStateFromSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const query = useMemo(() => convertReportViewStateToQuery(state), [state]);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);
  const reportQuery = useAdsQuery((signal) => reportsApi.fetchReport(accountId, query, signal), `${accountId}-${JSON.stringify(query)}`);
  const report = reportQuery.data;

  function replaceViewState(next: ReportViewState) {
    router.replace(`${pathname}?${writeReportViewStateToSearchParams(next).toString()}`, { scroll: false });
  }

  async function downloadReport(format: "csv" | "pdf") {
    setExportFormat(format);
    try {
      const blob = format === "pdf"
        ? await reportsApi.exportReportAsPdf(accountId, query, state.columns)
        : await reportsApi.exportReportAsCsv(accountId, query, state.columns);
      saveBlobAsDownloadedFile(blob, `nantty-ads-${state.breakdown}-${state.from}-to-${state.to}.${format}`);
      showToast(`${format.toUpperCase()} downloaded`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setExportFormat(null);
    }
  }

  const chartDefinition = findMetricDefinition(state.chartMetric);
  const rangeLabel = formatDateRangeForDisplay(state);
  const breakdownLabel = breakdownOptions.find((option) => option.breakdown === state.breakdown)?.label ?? "Item";
  const bars = (report?.rows ?? []).map((row) => ({
    key: row.key,
    label: state.breakdown === "day" ? formatDateWithYear(row.key) : row.label,
    value: readMetricNumericValue(row.metrics, state.chartMetric) ?? 0,
    formattedValue: formatMetricValueForDisplay(row.metrics, state.chartMetric),
    comparisonValue: row.comparison ? readMetricNumericValue(row.comparison, state.chartMetric) : null,
    formattedComparisonValue: row.comparison ? formatMetricValueForDisplay(row.comparison, state.chartMetric) : undefined,
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Delivery and results for ${rangeLabel}. Sales from your Nantty store are attributed automatically.`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" iconName="boxArrowDown24" isLoading={exportFormat === "pdf"} disabled={exportFormat !== null} onClick={() => void downloadReport("pdf")}>Export PDF</Button>
            <Button iconName="boxArrowDown24" isLoading={exportFormat === "csv"} disabled={exportFormat !== null} onClick={() => void downloadReport("csv")}>Export CSV</Button>
          </div>
        }
      />
      <Card>
        <ReportFilters state={state} onStateChange={replaceViewState} />
      </Card>
      {reportQuery.errorMessage ? (
        <div className={styles.spacedBlock}>
          <ErrorState error={reportQuery.error} message={reportQuery.errorMessage} onRetry={reportQuery.reload} />
        </div>
      ) : null}
      <div className={styles.chartGrid}>
        <Card
          title={`${chartDefinition.label} by day`}
          description={state.isComparing ? `Dashed line: ${formatDateRangeForDisplay(buildPreviousPeriodForComparison(state))}` : undefined}
          actions={<SelectField label="Chart metric" hideLabel value={state.chartMetric} onValueChange={(chartMetric: MetricKey) => replaceViewState({ ...state, chartMetric })} options={metricDefinitions.map((definition) => ({ value: definition.key, label: definition.label }))} />}
        >
          {report ? (
            <LineChart
              title={`${chartDefinition.label} by day`}
              description={`Daily ${chartDefinition.label.toLowerCase()} for ${rangeLabel}.`}
              seriesLabel={rangeLabel}
              points={convertSeriesToLineChartPoints(report.series, state.chartMetric)}
              comparisonLabel={state.isComparing ? "Previous period" : undefined}
              comparisonPoints={state.isComparing ? convertSeriesToLineChartPoints(report.comparisonSeries, state.chartMetric) : undefined}
              formatAxisValue={buildAxisValueFormatterForMetric(state.chartMetric, currency)}
            />
          ) : (
            <LoadingBlock label="Loading chart" height={240} />
          )}
        </Card>
        <Card title={`${chartDefinition.label} by ${breakdownLabel.toLowerCase()}`}>
          {report ? (
            bars.length > 0 ? (
              <HorizontalBarChart title={`${chartDefinition.label} by ${breakdownLabel.toLowerCase()}`} metricLabel={rangeLabel} bars={bars} comparisonLabel={state.isComparing ? "Previous period" : undefined} />
            ) : (
              <p className={styles.quietText}>No delivery in this range.</p>
            )
          ) : (
            <LoadingBlock label="Loading breakdown" height={240} />
          )}
        </Card>
      </div>
      <div className={styles.spacedBlock}>
        <Card padded={false}>
          {report ? (
            <ReportBreakdownTable
              report={report}
              breakdown={state.breakdown}
              visibleColumns={state.columns}
              onVisibleColumnsChange={(columns) => replaceViewState({ ...state, columns: columns.length > 0 ? columns : state.columns })}
              toolbar={
                <span className={styles.tableCaption}>
                  {report.rows.length} {breakdownLabel.toLowerCase()} row{report.rows.length === 1 ? "" : "s"} · attribution {state.clickWindowDays}-day click{state.viewWindowDays ? ", 1-day view" : ""}
                </span>
              }
            />
          ) : (
            <LoadingBlock label="Loading table" height={280} />
          )}
        </Card>
      </div>
      <div className={styles.spacedBlock}>
        <ScheduledReportsPanel accountId={accountId} breakdown={state.breakdown} metrics={state.columns} />
      </div>
    </>
  );
}
