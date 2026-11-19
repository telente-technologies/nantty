import type { IdentityCaptureSession, IdentityDocumentCountries, IdentityDocumentTypes, IdentityEligibility, IdentityJourney } from "@/types/identityVerification.type";

import { api } from "../core/apiClient.service";

export const identityVerificationService = {
  fetchVerificationJourney: () => api.get<IdentityJourney>("/api/v1/verification/journey"),
  requestVerification: () => api.post<IdentityEligibility>("/api/v1/verification/eligibility/request"),
  listDocumentCountries: () => api.get<IdentityDocumentCountries>("/api/v1/verification/document-types"),
  listDocumentTypes: (country: string) => api.get<IdentityDocumentTypes>("/api/v1/verification/document-types", { country }),
  startIdentityCapture: (caseId: string, input: { consentVersion: string; consentAccepted: boolean; platform: "ios" | "android"; verificationMethod: "document" | "id_number"; verificationProduct: "document_verification" | "enhanced_document_verification" | "enhanced_kyc"; documentCountry: string; documentType: string }) =>
    api.post<IdentityCaptureSession>(`/api/v1/verification/cases/${encodeURIComponent(caseId)}/capture`, input),
  cancelIdentityCapture: (caseId: string, captureAttemptId: string) =>
    api.post<void>(`/api/v1/verification/cases/${encodeURIComponent(caseId)}/capture/cancel`, { captureAttemptId }),
};
