import { ApiError } from "@/errors/api.error";
import type { IdentityCase, IdentityEligibility, IdentityJourney } from "@/types/identityVerification.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const documentsByCountry: Record<string, readonly { code: string; name: string; hasBack: boolean }[]> = {
  NG: ["IDENTITY_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  GH: ["IDENTITY_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  US: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  CA: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD", "CITIZEN_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  FR: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD", "RESIDENT_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  IN: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD", "RESIDENT_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  AU: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD", "PROVISIONAL_DRIVERS_LICENSE"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
  BR: ["PASSPORT", "DRIVERS_LICENSE", "IDENTITY_CARD", "RESIDENT_ID"].map((code) => ({ code, name: code.replaceAll("_", " "), hasBack: code !== "PASSPORT" })),
};

let eligibility: IdentityEligibility = { state: "assessed", tier: "request", trustScore: 58, reasons: ["real_followers_below_threshold"], canBuyNow: false, requestedAt: null, nextCheckAt: null };
let verificationCase: IdentityCase | null = null;

const journey = (): IdentityJourney => ({
  profileId: "p_me", profileType: "personal", color: "blue", blackVetting: false, planCode: "blue", consentVersion: "2026-11-20", privacyPolicyUrl: "https://nantty.com/privacy", eligibility, case: verificationCase,
  checkmark: verificationCase?.status === "approved" ? { color: "blue", status: "verified", badgeVisible: true } : null,
});

export const identityVerificationMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/verification/journey", () => {
    return journey();
  }),
  createMockRoute("POST", "/api/v1/verification/eligibility/request", () => {
    eligibility = { ...eligibility, state: "eligible", tier: "buy_now", trustScore: 81, canBuyNow: true, requestedAt: new Date().toISOString(), reasons: [] };
    verificationCase = { id: "vc_mock", color: "blue", planCode: "blue", paymentChannel: "apple_iap", status: "awaiting_consent", refundStatus: "not_applicable", refundMethod: "apple_request", refundScope: "full", consentGiven: false, decisionReason: "", createdAt: new Date().toISOString(), decidedAt: null, verifiedAt: null, canRetry: true };
    return eligibility;
  }),
  createMockRoute("GET", "/api/v1/verification/document-types", ({ query }) => {
    const country = query.get("country");
    if (!country) return { catalogSource: "preview", countries: [{ code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" }, { code: "US", name: "United States" }, { code: "CA", name: "Canada" }, { code: "FR", name: "France" }, { code: "IN", name: "India" }, { code: "AU", name: "Australia" }, { code: "BR", name: "Brazil" }], availability: { documentVerification: true, enhancedDocumentVerification: false, idNumberVerification: true } };
    return {
      country, catalogSource: "preview", documentTypes: documentsByCountry[country] ?? [], enhancedDocumentTypes: [],
      idNumberTypes: country === "NG" ? ["NIN_V2", "NIN_SLIP", "V_NIN"].map((type) => ({ country, type, label: type.replaceAll("_", " "), regex: type === "V_NIN" ? "^[a-zA-Z0-9]{16}$" : "^[0-9]{11}$" })) : [],
      availability: { documentVerification: Boolean(documentsByCountry[country]?.length), enhancedDocumentVerification: false, idNumberVerification: country === "NG" },
    };
  }),
  createMockRoute("POST", "/api/v1/verification/cases/:caseId/capture", ({ body }) => {
    const input = body as { consentAccepted?: boolean; verificationMethod?: string; verificationProduct?: string };
    if (!input.consentAccepted) throw new ApiError(400, "Accept the identity-verification consent first");
    if (!verificationCase) throw new ApiError(404, "That verification was not found");
    verificationCase = { ...verificationCase, status: "awaiting_capture", consentGiven: true };
    return { mode: "hosted_link", url: "https://links.usesmileid.com/mock", product: input.verificationProduct ?? (input.verificationMethod === "id_number" ? "enhanced_kyc" : "document_verification"), caseId: "vc_mock", captureAttemptId: "mock-attempt" };
  }),
  createMockRoute("POST", "/api/v1/verification/cases/:caseId/capture/cancel", () => {
    if (!verificationCase) throw new ApiError(404, "That verification was not found");
    verificationCase = { ...verificationCase, status: "awaiting_consent", consentGiven: false };
    return { cancelled: true };
  }),
];
