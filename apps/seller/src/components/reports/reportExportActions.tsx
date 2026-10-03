"use client";

import { useState } from "react";

import { FeaturePlanBadge } from "@/components/billing/planGate";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toastProvider";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ReportResult } from "@/types/report.type";
import { triggerBrowserDownload } from "@/utils/csvFile.util";
import { createXlsxBlob } from "@/utils/xlsxWorkbook.util";

import { buildReportFileBaseName, convertReportResultToSpreadsheetSheet } from "./reportExport.util";
import styles from "./reports.module.css";

interface ReportExportActionsProps {
  readonly report: ReportResult | null;
  readonly reportQueryParameters: Record<string, string>;
  readonly usesDateRange: boolean;
  readonly currency: string | null;
}

export function ReportExportActions({ report, reportQueryParameters, usesDateRange, currency }: ReportExportActionsProps) {
  const { showToast } = useToast();
  const { hasFeature } = usePlanFeatures();
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const canExportAdvancedFormats = hasFeature("advanced_reports");

  async function downloadReportAsCsvFile() {
    if (!report) return;
    setIsExportingCsv(true);
    try {
      const csvBlob = await sendSellerApiRequest<Blob>(`/seller/reports/${report.reportKind}`, { query: { ...reportQueryParameters, format: "csv" }, expect: "blob" });
      triggerBrowserDownload(`${buildReportFileBaseName(report, usesDateRange)}.csv`, csvBlob);
      showToast("CSV downloaded.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsExportingCsv(false);
    }
  }

  function downloadReportAsExcelWorkbook() {
    if (!report) return;
    triggerBrowserDownload(`${buildReportFileBaseName(report, usesDateRange)}.xlsx`, createXlsxBlob([convertReportResultToSpreadsheetSheet(report, currency)]));
    showToast("Excel file downloaded.");
  }

  return (
    <div className={styles.exportActions}>
      <Button iconName="export24" onClick={() => void downloadReportAsCsvFile()} isBusy={isExportingCsv} disabled={!report}>
        CSV
      </Button>
      <Button iconName="export24" onClick={downloadReportAsExcelWorkbook} disabled={!report || !canExportAdvancedFormats}>
        Excel <FeaturePlanBadge feature="advanced_reports" />
      </Button>
      <Button variant="ghost" onClick={() => window.print()} disabled={!report || !canExportAdvancedFormats}>
        PDF <FeaturePlanBadge feature="advanced_reports" />
      </Button>
    </div>
  );
}
