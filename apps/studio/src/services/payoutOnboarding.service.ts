import type { PayoutBankInput, PayoutBusinessInput, PayoutDocumentLink, PayoutFees, PayoutIdentityInput, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import type { Page } from "@/types";
import type { BvnConsentStart, BvnConsentStatus, MyProviderWallet, MyVerificationLevel } from "@/types/providerWallet.type";

import { sendRequestToStudioServer } from "./clientApi.service";

const base = "/api/v1/payments/payout-onboarding/me";

export interface PayoutBank {
  readonly code: string;
  readonly name: string;
}

export const payoutOnboardingService = {
  fetchState: () => sendRequestToStudioServer<PayoutOnboardingState>(base),
  saveIdentity: (body: PayoutIdentityInput) => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/identity`, { method: "PUT", body }),
  saveBusiness: (body: PayoutBusinessInput) => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/business`, { method: "PUT", body }),
  saveBank: (body: PayoutBankInput, stepUpToken: string) => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/bank`, { method: "PUT", body, stepUpToken }),
  resolveAccountName: (bankCode: string, accountNumber: string) => sendRequestToStudioServer<{ accountName: string }>(`${base}/resolve`, { method: "POST", body: { bankCode, accountNumber } }),
  listBanks: async () => (await sendRequestToStudioServer<Page<PayoutBank>>("/api/v1/banks", { query: { country: "NG" } })).data,
  retryAccountCreation: () => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/retry`, { method: "POST" }),
  createDocumentLink: () => sendRequestToStudioServer<PayoutDocumentLink>(`${base}/document-link`, { method: "POST" }),
  completeMockDocumentUpload: () => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/document-link/complete`, { method: "POST" }),
  startBvnConsent: (returnTo: string) => sendRequestToStudioServer<BvnConsentStart>(`${base}/bank-validation`, { method: "POST", query: { returnTo } }),
  fetchBvnConsent: () => sendRequestToStudioServer<{ readonly status: BvnConsentStatus }>(`${base}/bank-validation`),
  fetchMyWalletAccount: () => sendRequestToStudioServer<MyProviderWallet>("/api/v1/payments/wallet/me"),
  fetchMyVerificationLevel: () => sendRequestToStudioServer<MyVerificationLevel>("/api/v1/payments/verification/me"),
  fetchPayoutFees: () => sendRequestToStudioServer<PayoutFees>("/api/v1/payments/payout-fees"),
};
