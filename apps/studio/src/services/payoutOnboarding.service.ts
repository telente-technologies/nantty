import type { PayoutBankInput, PayoutBusinessInput, PayoutDocumentLink, PayoutFees, PayoutIdentityInput, PayoutOnboardingState } from "@/types/payoutOnboarding.type";

import type { Page } from "@/types";

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
  saveBank: (body: PayoutBankInput) => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/bank`, { method: "PUT", body }),
  resolveAccountName: (bankCode: string, accountNumber: string) => sendRequestToStudioServer<{ accountName: string }>(`${base}/resolve`, { method: "POST", body: { bankCode, accountNumber } }),
  listBanks: async () => (await sendRequestToStudioServer<Page<PayoutBank>>("/api/v1/banks", { query: { country: "NG" } })).data,
  retryAccountCreation: () => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/retry`, { method: "POST" }),
  createDocumentLink: () => sendRequestToStudioServer<PayoutDocumentLink>(`${base}/document-link`, { method: "POST" }),
  completeMockDocumentUpload: () => sendRequestToStudioServer<PayoutOnboardingState>(`${base}/document-link/complete`, { method: "POST" }),
  fetchPayoutFees: () => sendRequestToStudioServer<PayoutFees>("/api/v1/payments/payout-fees"),
};
