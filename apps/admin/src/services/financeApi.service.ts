import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type {
  FinanceAspect,
  FinanceEscrowRecord,
  FinanceIssuesResponse,
  FinanceLookupResult,
  FinanceOverview,
  FinanceRange,
  FinanceReportKey,
  FinanceReportsCatalog,
  MoneyByAspectResponse,
  ProviderMirrorReport,
  SellerReserveHold,
  StuckPayoutAccount,
} from "@/types/finance.type";

export function fetchFinanceOverview(range: FinanceRange, currency?: string, signal?: AbortSignal): Promise<FinanceOverview> {
  return sendAdminApiRequest("/admin/finance/overview", { query: { range, currency }, signal });
}

export function fetchMoneyByAspect(aspect: FinanceAspect, range: FinanceRange, currency?: string, signal?: AbortSignal): Promise<MoneyByAspectResponse> {
  return sendAdminApiRequest("/admin/finance/money-by-aspect", { query: { aspect, range, currency }, signal });
}

export function fetchEscrowHeld(filters: { readonly status?: string; readonly currency?: string; readonly cursor?: string }, signal?: AbortSignal): Promise<PagedList<FinanceEscrowRecord>> {
  return sendAdminApiRequest("/admin/finance/escrow-held", { query: { ...filters, limit: 50 }, signal });
}

export function fetchStuckEscrows(filters: { readonly currency?: string; readonly cursor?: string }, signal?: AbortSignal): Promise<PagedList<FinanceEscrowRecord>> {
  return sendAdminApiRequest("/admin/finance/stuck-escrows", { query: { ...filters, limit: 50 }, signal });
}

export function fetchFinanceIssues(filters: { readonly queue?: string; readonly limit?: number }, signal?: AbortSignal): Promise<FinanceIssuesResponse> {
  return sendAdminApiRequest("/admin/finance/issues", { query: { ...filters }, signal });
}

export function lookupFinanceReference(ref: string, signal?: AbortSignal): Promise<FinanceLookupResult> {
  return sendAdminApiRequest("/admin/finance/lookup", { query: { ref }, signal });
}

export function fetchFinanceReports(signal?: AbortSignal): Promise<FinanceReportsCatalog> {
  return sendAdminApiRequest("/admin/finance/reports", { signal });
}

export function exportFinanceReport(input: { readonly reportType: FinanceReportKey; readonly range: FinanceRange; readonly currency?: string; readonly reason: string; readonly idempotencyKey: string }): Promise<Blob> {
  const { idempotencyKey, ...body } = input;
  return sendAdminApiRequest("/admin/finance/reports/export", { method: "POST", body, idempotencyKey, expect: "blob", promptForStepUp: true });
}

export function fetchStuckPayoutAccounts(limit = 50, signal?: AbortSignal): Promise<{ data: StuckPayoutAccount[]; nextCursor: string | null }> {
  return sendAdminApiRequest("/admin/payments/payout-accounts/stuck", { query: { limit }, signal });
}

export function retryPayoutAccountJob(jobId: string, reason: string): Promise<unknown> {
  return sendAdminApiRequest(`/admin/payments/payout-accounts/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST", body: { reason } });
}

export function sendPayoutVerificationPrompt(userId: string, reason: string): Promise<{ sent: boolean }> {
  return sendAdminApiRequest(`/admin/payments/payout-accounts/${encodeURIComponent(userId)}/verification-prompt`, { method: "POST", body: { reason } });
}

export function fetchSellerReserves(limit = 50, signal?: AbortSignal): Promise<{ data: SellerReserveHold[]; nextCursor: string | null }> {
  return sendAdminApiRequest("/admin/wallet/seller-reserves", { query: { limit }, signal });
}

export function flagSellerReserve(sellerUserId: string, input: { reason: string; reserveBps: number; holdDays: number }): Promise<SellerReserveHold> {
  return sendAdminApiRequest(`/admin/wallet/seller-reserves/${encodeURIComponent(sellerUserId)}`, { method: "PUT", body: input });
}

export function releaseSellerReserve(sellerUserId: string, reason: string): Promise<void> {
  return sendAdminApiRequest(`/admin/wallet/seller-reserves/${encodeURIComponent(sellerUserId)}`, { method: "DELETE", body: { reason } });
}

export function runProviderBalanceReconciliation(reason: string): Promise<ProviderMirrorReport> {
  return sendAdminApiRequest("/admin/payments/reconciliations", { method: "POST", body: { reason } });
}
