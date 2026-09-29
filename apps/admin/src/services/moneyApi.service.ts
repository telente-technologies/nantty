import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { Money, PagedList } from "@/types/api.type";
import type { DisputeDetail, DisputeList, DisputeOutcome, OrderDetail, OrderSummary, RefundRecord } from "@/types/commerce.type";
import type { JournalEntryList, LedgerAccount } from "@/types/ledger.type";
import type { CoinTransactionDetail, CoinTransactionList, PayoutDetail, PayoutList } from "@/types/payouts.type";

export interface MoneyListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly page?: number;
}

export function fetchOrders(filters: MoneyListFilters & { readonly currency?: string }, signal?: AbortSignal): Promise<PagedList<OrderSummary>> {
  return sendAdminApiRequest("/admin/orders", { query: { ...filters }, signal });
}

export function fetchOrderDetail(orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
  return sendAdminApiRequest(`/admin/orders/${encodeURIComponent(orderId)}`, { signal });
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

export function fetchRefunds(filters: MoneyListFilters & { readonly source?: string }, signal?: AbortSignal): Promise<PagedList<RefundRecord>> {
  return sendAdminApiRequest("/admin/refunds", { query: { ...filters }, signal });
}

export function issueManualRefund(input: { readonly orderId: string; readonly amount: Money; readonly reason: string; readonly idempotencyKey: string }): Promise<RefundRecord> {
  const { idempotencyKey, ...body } = input;
  return sendAdminApiRequest("/admin/refunds", { method: "POST", body, idempotencyKey });
}

export function fetchPayouts(filters: MoneyListFilters, signal?: AbortSignal): Promise<PayoutList> {
  return sendAdminApiRequest("/admin/payouts", { query: { ...filters }, signal });
}

export function fetchPayoutDetail(payoutId: string, signal?: AbortSignal): Promise<PayoutDetail> {
  return sendAdminApiRequest(`/admin/payouts/${encodeURIComponent(payoutId)}`, { signal });
}

export function decidePayout(payoutId: string, decision: "approve" | "hold" | "reject", reason: string, idempotencyKey?: string): Promise<PayoutDetail> {
  return sendAdminApiRequest(`/admin/payouts/${encodeURIComponent(payoutId)}/${decision}`, { method: "POST", body: { reason }, idempotencyKey });
}

export function fetchCoinTransactions(filters: MoneyListFilters & { readonly kind?: string }, signal?: AbortSignal): Promise<CoinTransactionList> {
  return sendAdminApiRequest("/admin/coins", { query: { ...filters }, signal });
}

export function fetchCoinTransactionDetail(transactionId: string, signal?: AbortSignal): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/${encodeURIComponent(transactionId)}`, { signal });
}

export function markCoinTransactionReviewed(transactionId: string, note: string): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/${encodeURIComponent(transactionId)}/mark-reviewed`, { method: "POST", body: { reason: note } });
}

export function reverseCoinTransaction(transactionId: string, reason: string, idempotencyKey: string): Promise<CoinTransactionDetail> {
  return sendAdminApiRequest(`/admin/coins/${encodeURIComponent(transactionId)}/reverse`, { method: "POST", body: { reason }, idempotencyKey });
}

export function fetchLedgerCurrencies(signal?: AbortSignal): Promise<{ items: string[] }> {
  return sendAdminApiRequest("/admin/ledger/currencies", { signal });
}

export function fetchLedgerAccounts(currency: string, signal?: AbortSignal): Promise<{ items: LedgerAccount[] }> {
  return sendAdminApiRequest("/admin/ledger/accounts", { query: { currency }, signal });
}

export function fetchLedgerEntries(filters: { readonly currency: string; readonly accountId?: string; readonly page?: number }, signal?: AbortSignal): Promise<JournalEntryList> {
  return sendAdminApiRequest("/admin/ledger/entries", { query: { ...filters }, signal });
}
