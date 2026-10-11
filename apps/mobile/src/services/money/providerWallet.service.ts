import type { BvnConsentStart, MyProviderWallet, PaymentIntentView, PaymentVerificationLevel } from "@/types/providerWallet.type";

import { api } from "../core/apiClient.service";

export const BVN_CONSENT_RETURN_URL = "zudomart://payouts/bvn-return";

const onboardingBase = "/api/v1/payments/payout-onboarding/me";

export const providerWalletService = {
  fetchMyWallet: () => api.get<MyProviderWallet>("/api/v1/payments/wallet/me"),
  activateMyWallet: () => api.post<MyProviderWallet>("/api/v1/payments/wallet/me/activate"),
  fetchMyVerificationLevel: () => api.get<PaymentVerificationLevel>("/api/v1/payments/verification/me"),
  payFromWallet: (reference: string, idempotencyKey: string) =>
    api.post<PaymentIntentView>(`/api/v1/payments/wallet-payments/${encodeURIComponent(reference)}`, undefined, { idempotencyKey }),
  startBvnConsent: () => api.post<BvnConsentStart>(`${onboardingBase}/bank-validation?returnTo=${encodeURIComponent(BVN_CONSENT_RETURN_URL)}`),
  fetchBvnConsent: () => api.get<BvnConsentStart>(`${onboardingBase}/bank-validation`),
};
