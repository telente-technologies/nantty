import type { IdentityCaptureSession, IdentityDocumentTypes, IdentityEligibility, IdentityJourney } from "@/types/identityVerification.type";

import { api } from "./apiClient.service";

export const identityVerificationService = {
  fetchVerificationJourney: () => api.get<IdentityJourney>("/api/v1/verification/journey"),
  requestVerification: () => api.post<IdentityEligibility>("/api/v1/verification/eligibility/request"),
  listDocumentTypes: (country: string) => api.get<IdentityDocumentTypes>("/api/v1/verification/document-types", { country }),
  startIdentityCapture: (caseId: string, input: { consentVersion: string; consentAccepted: boolean; platform: "ios" | "android"; documentCountry: string; documentType: string }) =>
    api.post<IdentityCaptureSession>(`/api/v1/verification/cases/${encodeURIComponent(caseId)}/capture`, input),
};
