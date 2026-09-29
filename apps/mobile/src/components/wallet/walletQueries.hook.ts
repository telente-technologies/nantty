import { useQuery } from "@tanstack/react-query";

import { rewardsService } from "@/services/rewards.service";
import { walletsService } from "@/services/wallets.service";

export const walletQueryKeys = {
  balance: ["wallet", "balance"] as const,
  transactions: ["wallet", "transactions"] as const,
  payoutAccounts: ["wallet", "payoutAccounts"] as const,
  escrowHolds: ["wallet", "escrowHolds"] as const,
  loyalty: ["wallet", "loyalty"] as const,
  referrals: ["wallet", "referrals"] as const,
};

export const useWalletBalanceQuery = () => useQuery({ queryKey: walletQueryKeys.balance, queryFn: walletsService.fetchMyWalletBalance });
export const useWalletTransactionsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.transactions, queryFn: walletsService.listMyWalletTransactions });
export const usePayoutAccountsQuery = () =>
  useQuery({ queryKey: walletQueryKeys.payoutAccounts, queryFn: walletsService.listMyPayoutAccounts });
export const useEscrowHoldsQuery = () => useQuery({ queryKey: walletQueryKeys.escrowHolds, queryFn: walletsService.listMyEscrowHolds });
export const useLoyaltySummaryQuery = () => useQuery({ queryKey: walletQueryKeys.loyalty, queryFn: rewardsService.fetchMyLoyaltySummary });
export const useReferralSummaryQuery = () => useQuery({ queryKey: walletQueryKeys.referrals, queryFn: rewardsService.fetchMyReferralSummary });
