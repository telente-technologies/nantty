import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { Money, PagedList } from "@/types/api.type";
import type { CoinTransactionDetail, CoinTransactionList } from "@/types/coins.type";
import type { DisputeDetail, DisputeList, DisputeOutcome, OrderDetail, OrderSummary, RefundRecord } from "@/types/commerce.type";
import type { JournalEntryList, LedgerAccount } from "@/types/ledger.type";
import type { StaffWithdrawalDetail, StaffWithdrawalList, WithdrawalDecision } from "@/types/withdrawals.type";

export interface MoneyListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly cursor?: string;
}

export function fetchOrders(filters: MoneyListFilters & { readonly currency?: string }, signal?: AbortSignal): Promise<PagedList<OrderSummary>> {
  return sendAdminApiRequest("/admin/orders", { query: { ...filters }, signal });
}

export function fetchOrderDetail(orderIdOrNumber: string, signal?: AbortSignal): Promise<OrderDetail> {
  return sendAdminApiRequest(`/admin/orders/${encodeURIComponent(orderIdOrNumber)}`, { signal });
}

export function fetchDisputes(filters: MoneyListFilters, signal?: AbortSignal): Promise<DisputeList> {
  return sendAdminApiRequest("/admin/disputes", { query: { ...filters }, signal });
}

export function fetchDisputeDetail(disputeId: string, signal?: AbortSignal): Promise<DisputeDetail> {
  return sendAdminApiRequest(`/admin/disputes/${encodeURIComponent(disputeId)}`, { signal });
}

export interface ResolveDisputeInput {
  readonly outcome: DisputeOutcome;
  readonly refundAmount?: Money;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export function resolveDispute(disputeId: string, { idempotencyKey, ...body }: ResolveDisputeInput): Promise<DisputeDetail> {
  return sendAdminApiRequest(`/admin/disputes/${encodeURIComponent(disputeId)}/resolve`, { method: "POST", body, idempotencyKey });
}

export function fetchRefunds(filters: MoneyListFilters & { readonly source?: string; readonly orderId?: string }, signal?: AbortSignal): Promise<PagedList<RefundRecord>> {
  return sendAdminApiRequest("/admin/refunds", { query: { ...filters }, signal });
}

export function issueManualRefund(input: { readonly orderId: string; readonly amount: Money; readonly reason: string; readonly idempotencyKey: string }): Promise<RefundRecord> {
  const { idempotencyKey, ...body } = input;
  return sendAdminApiRequest("/admin/refunds", { method: "POST", body, idempotencyKey });
}

export function fetchWithdrawals(filters: MoneyListFilters, signal?: AbortSignal): Promise<StaffWithdrawalList> {
  return sendAdminApiRequest("/admin/withdrawals", { query: { ...filters }, signal });
}

export function fetchWithdrawalDetail(withdrawalId: string, signal?: AbortSignal): Promise<StaffWithdrawalDetail> {
  return sendAdminApiRequest(`/admin/withdrawals/${encodeURIComponent(withdrawalId)}`, { signal });
}

export function reviewWithdrawal(withdrawalId: string, input: { readonly decision: WithdrawalDecision; readonly reason: string; readonly idempotencyKey: string }): Promise<StaffWithdrawalDetail> {
  const { idempotencyKey, ...body } = input;
  return sendAdminApiRequest(`/admin/withdrawals/${encodeURIComponent(withdrawalId)}/review`, { method: "POST", body, idempotencyKey });
}

export function fetchCoinTransactions(filters: MoneyListFilters & { readonly kind?: string }, signal?: AbortSignal): Promise<CoinTransactionList> {
  return sendAdminApiRequest("/admin/coins/transactions", { query: { ...filters }, signal });
}

export function fetchCoinTransactionDetail(transactionId: string, signal?: AbortSignal): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/transactions/${encodeURIComponent(transactionId)}`, { signal });
}

export function markCoinTransactionReviewed(transactionId: string, note: string): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/transactions/${encodeURIComponent(transactionId)}/mark-reviewed`, { method: "POST", body: { reason: note } });
}

export function reverseCoinTransaction(transactionId: string, reason: string, idempotencyKey: string): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/transactions/${encodeURIComponent(transactionId)}/reverse`, { method: "POST", body: { reason }, idempotencyKey });
}

export function fetchLedgerCurrencies(signal?: AbortSignal): Promise<PagedList<string>> {
  return sendAdminApiRequest("/admin/ledger/currencies", { signal });
}

export function fetchLedgerAccounts(filters: { readonly currency: string; readonly cursor?: string }, signal?: AbortSignal): Promise<PagedList<LedgerAccount>> {
  return sendAdminApiRequest("/admin/ledger/accounts", { query: { ...filters, limit: 100 }, signal });
}

export function fetchLedgerEntries(filters: { readonly currency: string; readonly accountCode?: string; readonly cursor?: string }, signal?: AbortSignal): Promise<JournalEntryList> {
  return sendAdminApiRequest("/admin/ledger/journal-entries", { query: { ...filters }, signal });
}

export const fetchPayouts = fetchWithdrawals;
export const fetchPayoutDetail = fetchWithdrawalDetail;

export function decidePayout(withdrawalId: string, decision: WithdrawalDecision, reason: string, idempotencyKey: string): Promise<StaffWithdrawalDetail> {
  return reviewWithdrawal(withdrawalId, { decision, reason, idempotencyKey });
}
