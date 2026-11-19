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
  readonly withdrawalStatus?: string;
  readonly failureReason?: string | null;
  readonly createdAt: string;
}

export interface BankBranch {
  readonly code: string;
  readonly name: string;
}

export interface PayoutBank {
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
}

export const walletsService = {
  fetchMyWalletSummary: () => sendRequestToWebappServer<WalletSummary>("/api/v1/wallets/me"),
  fetchMyCoinBalance: () => sendRequestToWebappServer<CoinBalance>("/api/v1/coins/balance"),
  listMyTransactions: () => sendListRequestToWebappServer<WalletTransaction>("/api/v1/wallets/me/transactions"),
  listMyEscrowHolds: () => sendListRequestToWebappServer<EscrowHold>("/api/v1/wallets/me/escrow-holds"),
  listMyPayoutAccounts: () => sendListRequestToWebappServer<PayoutAccount>("/api/v1/wallets/me/payout-accounts"),
  listPayoutBanks: (countryCode: string) => sendListRequestToWebappServer<PayoutBank>("/api/v1/banks", { query: { country: countryCode } }),
  listBankBranches: (countryCode: string, bankCode: string) => sendListRequestToWebappServer<BankBranch>(`/api/v1/banks/${encodeURIComponent(bankCode)}/branches`, { query: { country: countryCode } }),
  addPayoutAccount: (input: { readonly bankCode: string; readonly branchCode?: string; readonly countryCode: string; readonly accountNumber: string }, stepUpToken: string) =>
    sendRequestToWebappServer<PayoutAccount>("/api/v1/wallets/me/payout-accounts", { method: "POST", body: input, stepUpToken }),
  removePayoutAccount: (payoutAccountId: string, stepUpToken: string) =>
    sendRequestToWebappServer<void>(`/api/v1/wallets/me/payout-accounts/${encodeURIComponent(payoutAccountId)}`, { method: "DELETE", stepUpToken }),
  quoteWithdrawal: (payoutAccountId: string, amountMinor: number, currency: string) =>
    sendRequestToWebappServer<WithdrawalQuote>("/api/v1/wallets/me/withdrawals/quote", { query: { payoutAccountId, amountMinor, currency } }),
  listMyWithdrawals: () => sendListRequestToWebappServer<Withdrawal>("/api/v1/wallets/me/withdrawals"),
  requestWithdrawal: (request: WithdrawalRequest, idempotencyKey: string, stepUpToken: string) =>
    sendRequestToWebappServer<WalletTransaction>("/api/v1/wallets/me/withdrawals", { method: "POST", body: request, idempotencyKey, stepUpToken }),
  cancelWithdrawal: (withdrawalId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Withdrawal>(`/api/v1/wallets/me/withdrawals/${encodeURIComponent(withdrawalId)}/cancel`, { method: "POST", idempotencyKey }),
};
