import type {
  BlackApplicationInput,
  BlackApplicationSummary,
  CheckmarkSuggestionSummary,
  GovernmentBlackBillingDashboard,
  MyVerification,
  SavedCardSummary,
  VerificationDiscounts,
  VerificationPlan,
} from "@/types/verification.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const verificationShopService = {
  listVerificationPlans: () => sendListRequestToWebappServer<VerificationPlan>("/api/v1/verification/plans"),
  fetchMyVerification: () => sendRequestToWebappServer<MyVerification>("/api/v1/verification/me"),
  fetchVerificationDiscounts: () => sendRequestToWebappServer<VerificationDiscounts>("/api/v1/verification/discounts"),
  listCheckmarkSuggestions: () => sendListRequestToWebappServer<CheckmarkSuggestionSummary>("/api/v1/verification/suggestions"),
  dismissCheckmarkSuggestion: (color: "blue" | "gold") => sendRequestToWebappServer<void>(`/api/v1/verification/suggestions/${color}/dismiss`, { method: "POST" }),
  cancelVerificationSubscription: () =>
    sendRequestToWebappServer<MyVerification>("/api/v1/verification/subscription/cancel", { method: "POST", idempotencyKey: createIdempotencyKey("verification-cancel") }),
  submitBlackApplication: (input: BlackApplicationInput) =>
    sendRequestToWebappServer<{ applicationId: string; institutionalEmailVerificationRequired: boolean }>("/api/v1/verification/black-applications", { method: "POST", body: input }),
  sendBlackEmailOtp: (applicationId: string) =>
    sendRequestToWebappServer<{ sent: boolean; expiresAt?: string; verified?: boolean }>(`/api/v1/verification/black-applications/${encodeURIComponent(applicationId)}/email/send-otp`, { method: "POST", body: {} }),
  verifyBlackEmailOtp: (applicationId: string, code: string) =>
    sendRequestToWebappServer<BlackApplicationSummary>(`/api/v1/verification/black-applications/${encodeURIComponent(applicationId)}/email/verify`, { method: "POST", body: { code } }),
  submitBlackAppeal: (applicationId: string, input: { reason: string; supportingDetails?: string }) =>
    sendRequestToWebappServer<{ id: string; status: string }>(`/api/v1/verification/black-applications/${encodeURIComponent(applicationId)}/appeals`, { method: "POST", body: input }),
  fetchGovernmentBlackBilling: (profileId?: string) =>
    sendRequestToWebappServer<GovernmentBlackBillingDashboard>(profileId ? `/api/v1/verification/black/billing?profileId=${encodeURIComponent(profileId)}` : "/api/v1/verification/black/billing"),
  startGovernmentBlackCheckout: (input: { profileId?: string; termsAccepted: boolean; recurringConsent: boolean; returnTo: string }) =>
    sendRequestToWebappServer<{ subscriptionId: string; authorizationUrl: string; reference: string }>("/api/v1/verification/black/checkout", { method: "POST", body: { ...input, interval: "month" } }),
  startGovernmentBlackCardReplacement: (input: { profileId?: string; returnTo: string }) =>
    sendRequestToWebappServer<{ setupId: string; authorizationUrl: string; reference: string }>("/api/v1/verification/black/payment-method", { method: "POST", body: input }),
  reactivateGovernmentBlack: (profileId?: string) =>
    sendRequestToWebappServer<{ reactivated: boolean; actionUrl?: string }>("/api/v1/verification/black/reactivate", { method: "POST", body: { profileId } }),
  cancelGovernmentBlack: (profileId?: string) =>
    sendRequestToWebappServer<unknown>("/api/v1/verification/black/cancel", { method: "POST", body: { profileId } }),
  listSavedCards: () => sendListRequestToWebappServer<SavedCardSummary>("/api/v1/payments/saved-cards"),
  deleteSavedCard: (authorizationId: string) =>
    sendRequestToWebappServer<{ revoked: boolean; authorizationId: string }>(`/api/v1/payments/saved-cards/${encodeURIComponent(authorizationId)}`, { method: "DELETE" }),
};
