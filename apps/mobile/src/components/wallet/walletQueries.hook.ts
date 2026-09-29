import { useQuery } from "@tanstack/react-query";

import { walletsService } from "@/services/wallets.service";

export const walletQueryKeys = {
  balance: ["wallet", "balance"] as const,
  transactions: ["wallet", "transactions"] as const,
  payoutAccounts: ["wallet", "payoutAccounts"] as const,
};

export const useWalletBalanceQuery = () => useQuery({ queryKey: walletQueryKeys.balance, queryFn: walletsService.fetchMyWalletBalance });
export const useWalletTransactionsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.transactions, queryFn: walletsService.listMyWalletTransactions });
export const usePayoutAccountsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.payoutAccounts, queryFn: walletsService.listMyPayoutAccounts });
