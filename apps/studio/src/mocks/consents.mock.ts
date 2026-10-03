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
  createMockRoute("POST", "/api/v1/consents", ({ body }) => {
    const { policyVersion, decidedAt, categories, source } = (body ?? {}) as Partial<RecordedBannerConsent>;
    if (!policyVersion || !decidedAt || !categories) throw new ApiError(422, "policyVersion, decidedAt and categories are required");
    latestBannerConsent = { policyVersion, decidedAt, categories, source: source ?? "web_banner" };
    return latestBannerConsent;
  }),
  createMockRoute("GET", "/api/v1/consents", () => latestBannerConsent ?? { policyVersion: null, decidedAt: null, categories: {}, source: null }),
];
