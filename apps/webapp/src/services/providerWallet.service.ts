import type { PaymentVerificationLevel, ProviderWalletResponse, WalletPaymentResult } from "@/types/providerWallet.type";

import { sendRequestToWebappServer, WebappRequestError } from "./clientApi.service";

export const providerWalletQueryKeys = {
  wallet: ["payments", "wallet", "me"] as const,
  verification: ["payments", "verification", "me"] as const,
};

export function isWalletNotReadyError(error: unknown): boolean {
  return error instanceof WebappRequestError && error.code === "WALLET_NOT_READY";
}

export const providerWalletService = {
  fetchMyWallet: async (): Promise<ProviderWalletResponse | null> => {
    try {
      const response = await sendRequestToWebappServer<ProviderWalletResponse | { readonly wallet: null; readonly status: "not_ready" }>("/api/v1/payments/wallet/me");
      return response.wallet === null ? null : (response as ProviderWalletResponse);
    } catch (error) {
      if (isWalletNotReadyError(error)) return null;
      throw error;
    }
  },
  activateMyWallet: (idempotencyKey: string) => sendRequestToWebappServer<ProviderWalletResponse>("/api/v1/payments/wallet/me/activate", { method: "POST", idempotencyKey }),
  fetchMyVerificationLevel: () => sendRequestToWebappServer<PaymentVerificationLevel>("/api/v1/payments/verification/me"),
  payFromWallet: (reference: string, idempotencyKey: string) =>
    sendRequestToWebappServer<WalletPaymentResult>(`/api/v1/payments/wallet-payments/${encodeURIComponent(reference)}`, { method: "POST", idempotencyKey }),
};

export function walletSpendableMinor(response: ProviderWalletResponse | null | undefined): number {
  if (!response || response.wallet.status !== "active") return 0;
  return Math.max(0, response.balances.availableMinor + response.balances.depositHoldMinor - response.balances.debtMinor);
}

export function describePaymentPartner(provider: string | null | undefined): string {
  return provider === "flutterwave" ? "Payments are processed by Flutterwave, our licensed payment partner." : "Pay by card or bank transfer on our payment partner's secure page.";
}
