import type { IdentityCaptureSession, IdentityDocumentTypes, IdentityEligibility, IdentityJourney } from "@/types/identityVerification.type";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export interface CheckmarkCheckout {
  readonly subscriptionId: string;
  readonly authorizationUrl: string;
  readonly billingNote?: string;
}

export const identityVerificationService = {
  fetchVerificationJourney: () => sendRequestToWebappServer<IdentityJourney>("/api/v1/verification/journey"),
  requestVerification: () => sendRequestToWebappServer<IdentityEligibility>("/api/v1/verification/eligibility/request", { method: "POST" }),
  listDocumentTypes: (country: string) => sendRequestToWebappServer<IdentityDocumentTypes>("/api/v1/verification/document-types", { query: { country } }),
  startIdentityCapture: (caseId: string, input: { consentVersion: string; consentAccepted: boolean; documentCountry: string; documentType: string }) =>
    sendRequestToWebappServer<IdentityCaptureSession>(`/api/v1/verification/cases/${encodeURIComponent(caseId)}/capture`, { method: "POST", body: { ...input, platform: "web" } }),
  startCheckmarkCheckout: (input: { profileId: string; planCode: string; interval: "month" | "year"; returnTo: string }) =>
    sendRequestToWebappServer<CheckmarkCheckout>("/api/v1/subscriptions/checkout", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("checkmark") }),
};
