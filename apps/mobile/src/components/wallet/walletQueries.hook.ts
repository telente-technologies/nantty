import { useQuery } from "@tanstack/react-query";

import { storeRewardsService } from "@/services/sellers/storeRewards.service";
import { walletsService } from "@/services/money/wallets.service";

export const walletQueryKeys = {
  balance: ["wallet", "balance"] as const,
  transactions: ["wallet", "transactions"] as const,
  payoutAccounts: ["wallet", "payoutAccounts"] as const,
  escrowHolds: ["wallet", "escrowHolds"] as const,
  storeCredit: ["wallet", "storeCredit"] as const,
};

export const useWalletBalanceQuery = () => useQuery({ queryKey: walletQueryKeys.balance, queryFn: walletsService.fetchMyWalletBalance });
export const useWalletTransactionsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.transactions, queryFn: walletsService.listMyWalletTransactions });
export const usePayoutAccountsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.payoutAccounts, queryFn: walletsService.listMyPayoutAccounts });
export const useEscrowHoldsQuery = () => useQuery({ queryKey: walletQueryKeys.escrowHolds, queryFn: walletsService.listMyEscrowHolds });
export const useStoreCreditBalancesQuery = () => useQuery({ queryKey: walletQueryKeys.storeCredit, queryFn: storeRewardsService.listMyStoreCreditBalances });
