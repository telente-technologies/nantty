import type { CheckmarkSuggestionSummary, MyVerification, VerificationApplicationInput, VerificationCheckout, VerificationDiscounts, VerificationPlan } from "@/types/verification.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const verificationShopService = {
  listVerificationPlans: () => sendListRequestToWebappServer<VerificationPlan>("/api/v1/verification/plans"),
  fetchMyVerification: () => sendRequestToWebappServer<MyVerification>("/api/v1/verification/me"),
  fetchVerificationDiscounts: () => sendRequestToWebappServer<VerificationDiscounts>("/api/v1/verification/discounts"),
  listCheckmarkSuggestions: () => sendListRequestToWebappServer<CheckmarkSuggestionSummary>("/api/v1/verification/suggestions"),
  dismissCheckmarkSuggestion: (color: "blue" | "gold") => sendRequestToWebappServer<void>(`/api/v1/verification/suggestions/${color}/dismiss`, { method: "POST" }),
  submitVerificationApplication: (input: VerificationApplicationInput) =>
    sendRequestToWebappServer<VerificationCheckout>("/api/v1/verification/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("verification") }),
  cancelVerificationSubscription: () =>
    sendRequestToWebappServer<MyVerification>("/api/v1/verification/subscription/cancel", { method: "POST", idempotencyKey: createIdempotencyKey("verification-cancel") }),
};
