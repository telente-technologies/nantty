import { currentPolicyVersion } from "@/config/legalLinks.config";
import { ApiError } from "@/errors/api.error";
import type { ConsentRecord, DataExportRequest, UpdateConsentsInput } from "@/types/privacy.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const processingAfterMilliseconds = 3000;
const readyAfterMilliseconds = 9000;
const exportLinkLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;
const deletionGracePeriodMilliseconds = 30 * 24 * 60 * 60 * 1000;
const deletionConfirmationWord = "DELETE";

let consentRecord: ConsentRecord = {
  policyVersion: currentPolicyVersion,
  consents: { personalization: true, personalizedAds: true, analytics: true, marketing: false },
  updatedAt: new Date().toISOString(),
};
let exportRequestedAtMilliseconds: number | null = null;
let latestBannerConsent: unknown = null;

function describeDataExport(): DataExportRequest {
  if (exportRequestedAtMilliseconds === null) return { status: "none", requestedAt: null, downloadUrl: null, expiresAt: null };
  const elapsed = Date.now() - exportRequestedAtMilliseconds;
  const requestedAt = new Date(exportRequestedAtMilliseconds).toISOString();
  if (elapsed < processingAfterMilliseconds) return { status: "requested", requestedAt, downloadUrl: null, expiresAt: null };
  if (elapsed < readyAfterMilliseconds) return { status: "processing", requestedAt, downloadUrl: null, expiresAt: null };
  return { status: "ready", requestedAt, downloadUrl: "/mock/my-data-export.zip", expiresAt: new Date(exportRequestedAtMilliseconds + readyAfterMilliseconds + exportLinkLifetimeMilliseconds).toISOString() };
}

export const privacyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/consents", () => consentRecord),
  createMockRoute("PUT", "/api/v1/users/me/consents", ({ body }) => {
    const { policyVersion, consents } = body as UpdateConsentsInput;
    if (!policyVersion) throw new ApiError(422, "policyVersion is required");
    consentRecord = { policyVersion, consents: { ...consentRecord.consents, ...consents }, updatedAt: new Date().toISOString() };
    return consentRecord;
  }),
  createMockRoute("GET", "/api/v1/users/me/data-export", () => describeDataExport()),
  createMockRoute("POST", "/api/v1/users/me/data-export", () => {
    const { status } = describeDataExport();
    if (status === "requested" || status === "processing") throw new ApiError(409, "An export is already in progress");
    exportRequestedAtMilliseconds = Date.now();
    return describeDataExport();
  }),
  createMockRoute("POST", "/api/v1/users/me/deletion", ({ body }) => {
    if ((body as { confirmation?: string }).confirmation !== deletionConfirmationWord) throw new ApiError(422, `Type ${deletionConfirmationWord} to confirm`);
    return { scheduledFor: new Date(Date.now() + deletionGracePeriodMilliseconds).toISOString() };
  }),
  createMockRoute("POST", "/api/v1/consents", ({ body }) => {
    const { policyVersion, decidedAt, categories } = (body ?? {}) as Record<string, unknown>;
    if (typeof policyVersion !== "string" || typeof decidedAt !== "string" || typeof categories !== "object" || categories === null) throw new ApiError(422, "policyVersion, decidedAt and categories are required");
    latestBannerConsent = body;
    return latestBannerConsent;
  }),
];
