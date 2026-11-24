import { metricDefinitions } from "@/constants/reportOptions.constant";
import { findRecordInAccount, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { buildReportForQuery } from "@/mocks/mockReportEngine.mock";
import { createMockId, failValidation, paginateItems, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithDownload, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MetricKey, ReportBreakdown, ReportQuery, ReportFrequency } from "@/types/report.type";
import { convertMinorAmountToMajor } from "@/utils/money.util";
import { countDaysInRangeInclusive, isValidIsoDate } from "@/utils/dateRange.util";
import { isValidEmailAddress } from "@/utils/formValidation.util";

const breakdowns: readonly ReportBreakdown[] = ["campaign", "ad_set", "ad", "placement", "day", "country", "state", "age", "gender"];
const metricKeys = metricDefinitions.map((definition) => definition.key);

function readReportQuery(request: MockRequest): ReportQuery {
  const from = request.query.get("from");
  const to = request.query.get("to");
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) failValidation("from", "Choose a valid date range.");
  if (countDaysInRangeInclusive({ from, to }) > 400) failValidation("from", "Reports can cover at most 400 days.");
  const compareFrom = request.query.get("compareFrom");
  const compareTo = request.query.get("compareTo");
  const hasComparison = isValidIsoDate(compareFrom) && isValidIsoDate(compareTo) && compareFrom <= compareTo;
  const breakdown = breakdowns.includes(request.query.get("breakdown") as ReportBreakdown) ? (request.query.get("breakdown") as ReportBreakdown) : "campaign";
  const click = Number(request.query.get("clickWindowDays"));
  const view = Number(request.query.get("viewWindowDays"));
  return {
    from,
    to,
    compareFrom: hasComparison ? compareFrom : null,
    compareTo: hasComparison ? compareTo : null,
    breakdown,
    campaignIds: (request.query.get("campaignIds") ?? "").split(",").filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)).slice(0, 50),
    clickWindowDays: click === 1 || click === 28 ? click : 7,
    viewWindowDays: view === 0 ? 0 : 1,
  };
}

function escapeCsvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
}

function formatMetricForCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "amountMinor" in value) return convertMinorAmountToMajor(value as { amountMinor: number; currency: string }).toFixed(2);
  return typeof value === "number" ? String(Number(value.toFixed(4))) : String(value);
}

export function registerReportMockHandlers(): void {
  registerMockRoute("GET", "/ads/accounts/:accountId/reports", (request) => {
    const { account } = requireAccountAccess(request, "reports:view");
    return respondWithJson(200, buildReportForQuery(account.id, account.currency, readReportQuery(request)));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/reports/export", (request) => {
    const { account } = requireAccountAccess(request, "reports:view");
    const query = readReportQuery(request);
    const requested = (request.query.get("columns") ?? "").split(",").filter((key): key is MetricKey => metricKeys.includes(key as MetricKey));
    const columns = requested.length > 0 ? requested : metricKeys;
    const report = buildReportForQuery(account.id, account.currency, query);
    const header = [query.breakdown, ...columns.map((key) => `${metricDefinitions.find((definition) => definition.key === key)?.label ?? key}${metricDefinitions.find((definition) => definition.key === key)?.format === "money" ? ` (${account.currency})` : ""}`)];
    const lines = [header, ...report.rows.map((row) => [row.label, ...columns.map((key) => formatMetricForCsv(row.metrics[key]))]), ["Total", ...columns.map((key) => formatMetricForCsv(report.totals[key]))]];
    const csv = lines.map((cells) => cells.map(escapeCsvCell).join(",")).join("\r\n");
    return respondWithDownload(`nantty-ads-${account.id}-${query.breakdown}-${query.from}-to-${query.to}.csv`, `\uFEFF${csv}`, "text/csv; charset=utf-8");
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/reports/export.pdf", (request) => {
    const { account } = requireAccountAccess(request, "reports:view");
    const query = readReportQuery(request);
    const body = `%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n`;
    return respondWithDownload(`nantty-ads-${account.id}-${query.breakdown}-${query.from}-to-${query.to}.pdf`, body, "application/pdf");
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/reports/scheduled", (request) => {
    const { account } = requireAccountAccess(request, "reports:view");
    const page = paginateItems(readMockDatabase().scheduledReports.filter((report) => report.accountId === account.id), request);
    return respondWithJson(200, { ...page, items: page.items.map(({ accountId: _accountId, ...report }) => report) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/reports/scheduled", (request) => {
    const { account } = requireAccountAccess(request, "reports:manage");
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 100);
    const recipients = Array.isArray(body.recipients) ? body.recipients.filter((email): email is string => typeof email === "string").map((email) => email.trim().toLowerCase()) : [];
    if (recipients.length === 0 || recipients.length > 10 || !recipients.every(isValidEmailAddress)) failValidation("recipients", "Add 1 to 10 valid email addresses.");
    const frequency = ["daily", "weekly", "monthly"].includes(String(body.frequency)) ? (body.frequency as ReportFrequency) : failValidation("frequency", "Choose how often.");
    const breakdown = breakdowns.includes(body.breakdown as ReportBreakdown) ? (body.breakdown as ReportBreakdown) : "campaign";
    const metrics = Array.isArray(body.metrics) ? body.metrics.filter((key): key is MetricKey => metricKeys.includes(key as MetricKey)) : [];
    if (metrics.length === 0) failValidation("metrics", "Choose at least one metric.");
    const daysUntilNext = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 30;
    const report = { id: createMockId("srp"), accountId: account.id, name, recipients, frequency, breakdown, metrics, nextSendAt: new Date(Date.now() + daysUntilNext * 86_400_000).toISOString(), createdAt: readIsoNow() };
    readMockDatabase().scheduledReports.push(report);
    const { accountId: _accountId, ...publicReport } = report;
    return respondWithJson(201, publicReport);
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/reports/scheduled/:scheduledReportId", (request) => {
    const { account } = requireAccountAccess(request, "reports:manage");
    const database = readMockDatabase();
    const report = findRecordInAccount(database.scheduledReports, account.id, request.params.scheduledReportId, "scheduled report");
    database.scheduledReports.splice(database.scheduledReports.indexOf(report), 1);
    return respondWithNoContent();
  });
}
