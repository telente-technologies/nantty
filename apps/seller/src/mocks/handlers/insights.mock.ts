import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { findReportCatalogEntry } from "@/constants/reportCatalog.constant";
import { buildDashboardSummary } from "@/mocks/handlers/dashboardSummary.mock";
import { buildInventoryValuationReport, buildShiftsReport, buildTaxReport } from "@/mocks/handlers/reportOperationsBuilders.mock";
import { buildSalesByCategoryReport, buildSalesByDayReport, buildSalesByLocationReport, buildSalesByPaymentMethodReport, buildSalesByProductReport, buildSalesByStaffReport, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";
import { convertIsoToStoreDateKey, type ReportFilters } from "@/mocks/handlers/reportSalesRecords.mock";
import { registerWalletMockHandlers } from "@/mocks/handlers/walletLedger.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStorePrincipal, respondWithCsv, respondWithError, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { ReportCellValue, ReportColumn, ReportKind, ReportResult } from "@/types/report.type";
import { convertRowsToCsvText } from "@/utils/csvFile.util";
import { convertMinorUnitsToMajorInputText, isSupportedCurrencyCode } from "@/utils/money.util";

const reportBuilderByKind: Record<ReportKind, (filters: ReportFilters) => BuiltReportTable> = {
  "sales-by-day": buildSalesByDayReport,
  "sales-by-product": buildSalesByProductReport,
  "sales-by-category": buildSalesByCategoryReport,
  "sales-by-staff": buildSalesByStaffReport,
  "sales-by-payment-method": buildSalesByPaymentMethodReport,
  "sales-by-location": buildSalesByLocationReport,
  tax: buildTaxReport,
  "inventory-valuation": buildInventoryValuationReport,
  shifts: buildShiftsReport,
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function formatReportCellForCsv(value: ReportCellValue, column: ReportColumn): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return isSupportedCurrencyCode(value.currency) ? convertMinorUnitsToMajorInputText(value.amountMinor, value.currency) : String(value.amountMinor);
  if (column.kind === "percent" && typeof value === "number") return (value / 100).toFixed(2);
  return String(value);
}

function readReportFiltersFromQuery(query: URLSearchParams, timezone: string): ReportFilters | { issues: { path: string; message: string }[] } {
  const todayKey = convertIsoToStoreDateKey(new Date().toISOString(), timezone);
  const fromKey = query.get("from") ?? convertIsoToStoreDateKey(new Date(Date.now() - 29 * 86_400_000).toISOString(), timezone);
  const toKey = query.get("to") ?? todayKey;
  const channel = query.get("channel") ?? "all";
  const locationParameter = query.get("locationId");
  const issues: { path: string; message: string }[] = [];
  if (!dateKeyPattern.test(fromKey) || !dateKeyPattern.test(toKey) || fromKey > toKey) issues.push({ path: "from", message: "Pick a valid date range." });
  else if ((new Date(toKey).getTime() - new Date(fromKey).getTime()) / 86_400_000 > 366) issues.push({ path: "from", message: "Reports cover at most one year at a time." });
  if (channel !== "all" && channel !== "pos" && channel !== "online") issues.push({ path: "channel", message: "Choose all, in store or online." });
  const locationId = locationParameter && locationParameter !== "all" ? locationParameter : null;
  if (locationId && !readMockDatabase().locations.some((location) => location.id === locationId)) issues.push({ path: "locationId", message: "Choose one of your locations." });
  if (issues.length > 0) return { issues };
  return { fromKey, toKey, channel: channel as ReportFilters["channel"], locationId };
}

export function registerInsightsMockHandlers(): void {
  registerWalletMockHandlers();

  registerMockRoute("GET", "/seller/dashboard", (request) => {
    const principal = requireMockStorePrincipal(request);
    const locationParameter = request.query.get("locationId");
    const locationId = locationParameter && locationParameter !== "all" ? locationParameter : null;
    if (locationId && !readMockDatabase().locations.some((location) => location.id === locationId)) return respondWithValidationFailure([{ path: "locationId", message: "Choose one of your locations." }]);
    return respondWithJson(200, buildDashboardSummary(locationId, doesRoleHavePermission(principal.role, "wallet:view")));
  });

  registerMockRoute("GET", "/seller/reports/:reportKind", (request) => {
    requireMockStorePrincipal(request);
    const catalogEntry = findReportCatalogEntry(request.params.reportKind ?? "");
    if (!catalogEntry) return respondWithError(404, "REPORT_NOT_FOUND", "That report does not exist.");
    const database = readMockDatabase();
    const filters = readReportFiltersFromQuery(request.query, database.settings.timezone);
    if ("issues" in filters) return respondWithValidationFailure(filters.issues);
    const table = reportBuilderByKind[catalogEntry.kind](filters);
    if (request.query.get("format") === "csv") {
      const csvHeaders = table.columns.map((column) => (column.kind === "money" ? `${column.label} (${database.settings.currency})` : column.kind === "percent" ? `${column.label} (%)` : column.label));
      const csvRows = [...table.rows, ...(table.totals ? [table.totals] : [])].map((row) => table.columns.map((column) => formatReportCellForCsv(row[column.key] ?? null, column)));
      return respondWithCsv(`${catalogEntry.kind}_${filters.fromKey}_${filters.toKey}.csv`, convertRowsToCsvText(csvHeaders, csvRows));
    }
    const result: ReportResult = { reportKind: catalogEntry.kind, title: catalogEntry.title, from: filters.fromKey, to: filters.toKey, columns: table.columns, rows: table.rows, totals: table.totals, generatedAt: new Date().toISOString() };
    return respondWithJson(200, result);
  });
}
