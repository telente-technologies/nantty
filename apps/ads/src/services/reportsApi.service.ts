import { buildAccountApiPath, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { Page } from "@/types/api.type";
import type { MetricKey, ReportQuery, ReportResponse, ScheduledReport, ScheduledReportInput } from "@/types/report.type";

function convertReportQueryToSearchParameters(query: ReportQuery) {
  return {
    from: query.from,
    to: query.to,
    compareFrom: query.compareFrom,
    compareTo: query.compareTo,
    breakdown: query.breakdown,
    campaignIds: query.campaignIds,
    clickWindowDays: query.clickWindowDays,
    viewWindowDays: query.viewWindowDays,
  };
}

export const reportsApi = {
  fetchReport: (accountId: string, query: ReportQuery, signal?: AbortSignal) =>
    sendAdsApiRequest<ReportResponse>(buildAccountApiPath(accountId, "/reports"), { query: convertReportQueryToSearchParameters(query), signal }),
  exportReportAsCsv: (accountId: string, query: ReportQuery, columns: readonly MetricKey[]) =>
    sendAdsApiRequest<Blob>(buildAccountApiPath(accountId, "/reports/export"), { query: { ...convertReportQueryToSearchParameters(query), columns }, expect: "blob" }),
  exportReportAsPdf: (accountId: string, query: ReportQuery, columns: readonly MetricKey[]) =>
    sendAdsApiRequest<Blob>(buildAccountApiPath(accountId, "/reports/export.pdf"), { query: { ...convertReportQueryToSearchParameters(query), columns }, expect: "blob" }),
  listScheduledReports: (accountId: string) => sendAdsApiRequest<Page<ScheduledReport>>(buildAccountApiPath(accountId, "/reports/scheduled")),
  createScheduledReport: (accountId: string, input: ScheduledReportInput) =>
    sendAdsApiRequest<ScheduledReport>(buildAccountApiPath(accountId, "/reports/scheduled"), { method: "POST", body: input }),
  deleteScheduledReport: (accountId: string, scheduledReportId: string) =>
    sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/reports/scheduled/${encodeURIComponent(scheduledReportId)}`), { method: "DELETE" }),
};
