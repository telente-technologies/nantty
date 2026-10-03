import { convertAccessToSellerPlan, isFeatureIncludedInPlan } from "@/config/planFeatures.config";
import { findReportCatalogEntry } from "@/constants/reportCatalog.constant";
import { buildBestSellersReport, buildLowStockReport, buildSlowSellersReport } from "@/mocks/handlers/reportCatalogBuilders.mock";
import { buildAdsCampaignsReport, buildFeesReport, buildPayoutsReport, buildRefundsReport, buildSettlementsReport } from "@/mocks/handlers/reportFinanceAndAdsBuilders.mock";
import { buildInventoryValuationReport, buildTaxReport } from "@/mocks/handlers/reportOperationsBuilders.mock";
import { buildNewVersusReturningCustomersReport, buildOrderFulfilmentTimeReport, buildOrdersByStatusReport, buildTopCustomersReport } from "@/mocks/handlers/reportOrderAndCustomerBuilders.mock";
import { buildSalesByCategoryReport, buildSalesByDayReport, buildSalesByLocationReport, buildSalesByProductReport, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";
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
  "sales-by-location": buildSalesByLocationReport,
  tax: buildTaxReport,
  "orders-by-status": buildOrdersByStatusReport,
  "order-fulfilment-time": buildOrderFulfilmentTimeReport,
  "inventory-valuation": buildInventoryValuationReport,
  "low-stock": buildLowStockReport,
  "customers-new-vs-returning": buildNewVersusReturningCustomersReport,
  "top-customers": buildTopCustomersReport,
  "best-sellers": buildBestSellersReport,
  "slow-sellers": buildSlowSellersReport,
  settlements: buildSettlementsReport,
  fees: buildFeesReport,
  refunds: buildRefundsReport,
  payouts: buildPayoutsReport,
  "ads-campaigns": buildAdsCampaignsReport,
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
  const locationParameter = query.get("locationId");
  const issues: { path: string; message: string }[] = [];
  if (!dateKeyPattern.test(fromKey) || !dateKeyPattern.test(toKey) || fromKey > toKey) issues.push({ path: "from", message: "Pick a valid date range." });
  else if ((new Date(toKey).getTime() - new Date(fromKey).getTime()) / 86_400_000 > 366) issues.push({ path: "from", message: "Reports cover at most one year at a time." });
  const locationId = locationParameter && locationParameter !== "all" ? locationParameter : null;
  if (locationId && !readMockDatabase().locations.some((location) => location.id === locationId)) issues.push({ path: "locationId", message: "Choose one of your locations." });
  if (issues.length > 0) return { issues };
  return { fromKey, toKey, locationId };
}

function isStoreOnPlanWithAdvancedReports(storeId: string): boolean {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  return isFeatureIncludedInPlan("advanced_reports", convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null }));
}

export function registerInsightsMockHandlers(): void {
  registerWalletMockHandlers();

  registerMockRoute("GET", "/seller/reports/:reportKind", (request) => {
    const principal = requireMockStorePrincipal(request);
    const catalogEntry = findReportCatalogEntry(request.params.reportKind ?? "");
    if (!catalogEntry) return respondWithError(404, "REPORT_NOT_FOUND", "That report does not exist.");
    if (catalogEntry.needsAdvancedReports && !isStoreOnPlanWithAdvancedReports(principal.storeId)) {
      return respondWithJson(402, { message: `${catalogEntry.title} is part of Pro. Upgrade to see it.`, code: "PLAN_FEATURE_REQUIRED", requiredPlan: "pro" });
    }
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
