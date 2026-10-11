import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/errors/api.error";
import { providerWalletService } from "@/services/money/providerWallet.service";
import { walletSpendableMinor } from "@/types/providerWallet.type";

export const providerWalletQueryKeys = {
  wallet: ["payments", "wallet", "me"] as const,
  verification: ["payments", "verification", "me"] as const,
  bvnConsent: ["payments", "bvnConsent"] as const,
};

export const isWalletNotReadyError = (error: unknown) => error instanceof ApiError && error.code === "WALLET_NOT_READY";

export function useProviderWallet() {
  const verification = useQuery({ queryKey: providerWalletQueryKeys.verification, queryFn: providerWalletService.fetchMyVerificationLevel, staleTime: 60_000 });
  const isNigeria = verification.data ? verification.data.country === "NG" : null;
  const wallet = useQuery({
    queryKey: providerWalletQueryKeys.wallet,
    queryFn: providerWalletService.fetchMyWallet,
    enabled: isNigeria === true,
    retry: (count, error) => !(error instanceof ApiError) && count < 2,
  });
  const active = wallet.data?.wallet.status === "active" ? wallet.data : null;
  return {
    verification,
    wallet,
    isNigeria,
    isMissing: wallet.data === null || isWalletNotReadyError(wallet.error),
    active,
    spendableMinor: active ? walletSpendableMinor(active.balances) : 0,
  };
}
