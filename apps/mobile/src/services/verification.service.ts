import type { CheckmarkSuggestion } from "@/types/trust.type";
import type { MyVerification, VerificationApplicationInput, VerificationCheckout, VerificationPlan } from "@/types/verification.type";

import { api } from "./apiClient.service";

export const verificationService = {
  listVerificationPlans: () => api.getList<VerificationPlan>("/api/v1/verification/plans"),
  listCheckmarkSuggestions: () => api.getList<CheckmarkSuggestion>("/api/v1/verification/suggestions"),
  dismissCheckmarkSuggestion: (color: "blue" | "gold") => api.post<void>(`/api/v1/verification/suggestions/${color}/dismiss`),
  fetchMyVerification: () => api.get<MyVerification>("/api/v1/verification/me"),
  submitVerificationApplication: (input: VerificationApplicationInput, idempotencyKey: string) =>
    api.post<VerificationCheckout>("/api/v1/verification/applications", input, { idempotencyKey }),
  cancelVerificationSubscription: (idempotencyKey: string) =>
    api.post<MyVerification>("/api/v1/verification/subscription/cancel", undefined, { idempotencyKey }),
};
