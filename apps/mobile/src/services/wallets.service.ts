import type { PayoutAccountInput, WithdrawalRequest } from "@/types/account.type";
import type { EscrowHold } from "@/types/commerce.type";
import type { PayoutAccount, WalletSummary, WalletTransaction } from "@/types";

import { api, generateIdempotencyKey } from "./apiClient.service";

export const walletsService = {
  fetchMyWalletBalance: () => api.get<WalletSummary>("/api/v1/wallets/me"),
  listMyWalletTransactions: () => api.getList<WalletTransaction>("/api/v1/wallets/me/transactions"),
  listMyEscrowHolds: () => api.getList<EscrowHold>("/api/v1/wallets/me/escrow-holds"),
  listMyPayoutAccounts: () => api.getList<PayoutAccount>("/api/v1/wallets/me/payout-accounts"),
  addPayoutAccount: (input: PayoutAccountInput) => api.post<PayoutAccount>("/api/v1/wallets/me/payout-accounts", input),
  removePayoutAccount: (payoutAccountId: string) =>
    api.delete<void>(`/api/v1/wallets/me/payout-accounts/${encodeURIComponent(payoutAccountId)}`),
  requestWithdrawalToPayoutAccount: (request: WithdrawalRequest, idempotencyKey: string = generateIdempotencyKey()) =>
    api.post<WalletTransaction>("/api/v1/wallets/me/withdrawals", request, { idempotencyKey }),
};
