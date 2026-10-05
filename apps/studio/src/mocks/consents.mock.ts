import { ApiError } from "@/errors/api.error";

import { createMockRoute, type MockRoute } from "./registry.mock";

interface RecordedBannerConsent {
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly categories: Record<string, boolean>;
  readonly source: string;
}

let latestBannerConsent: RecordedBannerConsent | null = null;

export const consentsMocks: MockRoute[] = [
  createMockRoute("PUT", "/api/v1/users/me/consents", ({ body }) => {
    const { policyVersion, consents } = (body ?? {}) as { policyVersion?: string; consents?: Record<string, boolean> };
    if (!policyVersion || !consents) throw new ApiError(422, "policyVersion and consents are required");
    latestBannerConsent = { policyVersion, decidedAt: new Date().toISOString(), categories: consents, source: "web_banner" };
    return { data: Object.entries(consents).map(([consentType, granted]) => ({ consentType, status: granted ? "granted" : "withdrawn", policyVersion, decidedAt: latestBannerConsent?.decidedAt ?? null })), nextCursor: null, policyVersion, needsRenewal: false };
  }),
];
