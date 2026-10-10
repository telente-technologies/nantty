import type { CoinBalance, PayoutAccount, WalletSummary, WalletTransaction } from "@/types";
import type { WithdrawalRequest } from "@/types/account.type";
import type { EscrowHold } from "@/types/commerce.type";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export interface WithdrawalQuote {
  readonly fee: import("@/types/money.type").Money;
  readonly netAmount: import("@/types/money.type").Money;
}

export interface Withdrawal {
  readonly id: string;
  readonly amount: import("@/types/money.type").Money;
  readonly status: string;
  readonly createdAt: string;
}

export const walletsService = {
  fetchMyWalletSummary: () => sendRequestToWebappServer<WalletSummary>("/api/v1/wallets/me"),
  fetchMyCoinBalance: () => sendRequestToWebappServer<CoinBalance>("/api/v1/coins/balance"),
  listMyTransactions: () => sendListRequestToWebappServer<WalletTransaction>("/api/v1/wallets/me/transactions"),
  listMyEscrowHolds: () => sendListRequestToWebappServer<EscrowHold>("/api/v1/wallets/me/escrow-holds"),
  listMyPayoutAccounts: () => sendListRequestToWebappServer<PayoutAccount>("/api/v1/wallets/me/payout-accounts"),
  addPayoutAccount: (input: { readonly bankCode: string; readonly accountNumber: string }) =>
    sendRequestToWebappServer<PayoutAccount>("/api/v1/wallets/me/payout-accounts", { method: "POST", body: input }),
  removePayoutAccount: (payoutAccountId: string) =>
    sendRequestToWebappServer<void>(`/api/v1/wallets/me/payout-accounts/${encodeURIComponent(payoutAccountId)}`, { method: "DELETE" }),
  quoteWithdrawal: (payoutAccountId: string, amountMinor: number, currency: string) =>
    sendRequestToWebappServer<WithdrawalQuote>("/api/v1/wallets/me/withdrawals/quote", { query: { payoutAccountId, amountMinor, currency } }),
  listMyWithdrawals: () => sendListRequestToWebappServer<Withdrawal>("/api/v1/wallets/me/withdrawals"),
  requestWithdrawal: (request: WithdrawalRequest, idempotencyKey: string) =>
    sendRequestToWebappServer<WalletTransaction>("/api/v1/wallets/me/withdrawals", { method: "POST", body: request, idempotencyKey }),
  cancelWithdrawal: (withdrawalId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Withdrawal>(`/api/v1/wallets/me/withdrawals/${encodeURIComponent(withdrawalId)}/cancel`, { method: "POST", idempotencyKey }),
};
