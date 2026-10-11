import { ApiError } from "@/errors/api.error";
import type { IdentityCase, IdentityEligibility, IdentityJourney } from "@/types/identityVerification.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const documentsByCountry: Record<string, readonly string[]> = { NG: ["NIN_SLIP", "IDENTITY_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"], GH: ["GHANA_CARD", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"] };

let eligibility: IdentityEligibility = { state: "assessed", tier: "request", trustScore: 58, reasons: ["real_followers_below_threshold"], canBuyNow: false, requestedAt: null, nextCheckAt: null };
let verificationCase: IdentityCase | null = null;

const journey = (): IdentityJourney => ({
  profileId: "p_me", profileType: "personal", color: "blue", blackVetting: false, planCode: "blue", consentVersion: "2026-10-04", eligibility, case: verificationCase,
  checkmark: verificationCase?.status === "approved" ? { color: "blue", status: "verified", badgeVisible: true } : null,
});

export const identityVerificationMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/verification/journey", () => {
    if (verificationCase?.status === "processing") verificationCase = { ...verificationCase, status: "approved", verifiedAt: new Date().toISOString(), decidedAt: new Date().toISOString() };
    return journey();
  }),
  createMockRoute("POST", "/api/v1/verification/eligibility/request", () => {
    eligibility = { ...eligibility, state: "eligible", tier: "buy_now", trustScore: 81, canBuyNow: true, requestedAt: new Date().toISOString(), reasons: [] };
    verificationCase = { id: "vc_mock", color: "blue", planCode: "blue", paymentChannel: "web_checkout", status: "awaiting_consent", refundStatus: "not_applicable", refundMethod: "card", refundScope: "full", consentGiven: false, decisionReason: "", createdAt: new Date().toISOString(), decidedAt: null, verifiedAt: null, canRetry: true };
    return eligibility;
  }),
  createMockRoute("GET", "/api/v1/verification/document-types", ({ query }) => {
    const country = query.get("country") ?? "NG";
    return { country, documentTypes: documentsByCountry[country] ?? ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"], governmentLookup: country in documentsByCountry };
  }),
  createMockRoute("POST", "/api/v1/verification/cases/:caseId/capture", ({ body }) => {
    const input = body as { consentAccepted?: boolean };
    if (!input.consentAccepted) throw new ApiError(400, "Accept the biometric consent first");
    if (!verificationCase) throw new ApiError(404, "That verification was not found");
    verificationCase = { ...verificationCase, status: "processing", consentGiven: true };
    return { mode: "web_integration", token: "mock-token", product: "enhanced_document_verification", jobId: "job_mock", partnerId: "0000", environment: "sandbox", callbackUrl: "https://api.zudomart.com/api/v1/webhooks/smile-id" };
  }),
];

identityVerificationMocks.push(
  createMockRoute("POST", "/api/v1/subscriptions/checkout", () => ({ subscriptionId: "sub_mock", authorizationUrl: "/settings/verification?step=paid" })),
);
