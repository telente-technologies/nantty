import * as WebBrowser from "expo-web-browser";

import { apiConfig } from "@/config/api.config";
import type { PayoutBankInput, PayoutBusinessInput, PayoutDocumentLink, PayoutFees, PayoutIdentityInput, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import { api } from "../core/apiClient.service";

const base = "/api/v1/payments/payout-onboarding/me";

export const PAYOUT_DOCUMENT_RETURN_URL = "zudomart://payouts/verification-return";

export const payoutOnboardingService = {
  fetchState: () => api.get<PayoutOnboardingState>(base),
  saveIdentity: (input: PayoutIdentityInput) => api.put<PayoutOnboardingState>(`${base}/identity`, input),
  saveBusiness: (input: PayoutBusinessInput) => api.put<PayoutOnboardingState>(`${base}/business`, input),
  saveBank: (input: PayoutBankInput) => api.put<PayoutOnboardingState>(`${base}/bank`, input),
  retryAccountCreation: () => api.post<PayoutOnboardingState>(`${base}/retry`),
  createDocumentLink: () => api.post<PayoutDocumentLink>(`${base}/document-link`),
  fetchPayoutFees: () => api.get<PayoutFees>("/api/v1/payments/payout-fees"),
  openSecureVerificationPage: async (link: PayoutDocumentLink): Promise<"returned" | "dismissed"> => {
    if (apiConfig.useMocks) {
      await api.post<PayoutOnboardingState>(`${base}/document-link/complete`);
      return "returned";
    }
    const result = await WebBrowser.openAuthSessionAsync(link.url, link.returnUrl);
    return result.type === "success" ? "returned" : "dismissed";
  },
};
