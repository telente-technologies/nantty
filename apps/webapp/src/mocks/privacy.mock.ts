import { currentPolicyVersion } from "@/config/legalLinks.config";
import { ApiError } from "@/errors/api.error";
import type { DataExportRequest } from "@/types/privacy.type";
import type { ProductInteractionRecord } from "@/types/privacy.type";

import { recordMockPolicyAcceptance } from "./legal.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const processingAfterMilliseconds = 3000;
const readyAfterMilliseconds = 9000;
const exportLinkLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;
const deletionGracePeriodMilliseconds = 30 * 24 * 60 * 60 * 1000;
const deletionConfirmationWord = "DELETE";
export const receivedProductInteractions: ProductInteractionRecord[] = [];

const optionalConsentTypes = ["analytics", "personalization", "advertising", "marketing"] as const;
let consentPolicyVersion = currentPolicyVersion;
const grantedConsentTypes = new Map<string, { granted: boolean; decidedAt: string }>(
  [["personalization", true], ["advertising", true], ["analytics", true], ["marketing", false]].map(([type, granted]) => [type as string, { granted: granted as boolean, decidedAt: new Date().toISOString() }]),
);

const describeConsents = () => ({
  data: optionalConsentTypes.map((consentType) => {
    const decision = grantedConsentTypes.get(consentType);
    return { consentType, status: decision ? (decision.granted ? "granted" : "withdrawn") : "undecided", policyVersion: consentPolicyVersion, decidedAt: decision?.decidedAt ?? null };
  }),
  nextCursor: null,
  policyVersion: consentPolicyVersion,
  needsRenewal: false,
});
let exportRequestedAtMilliseconds: number | null = null;

function describeDataExport(): DataExportRequest {
  if (exportRequestedAtMilliseconds === null) return { status: "none", requestedAt: null, downloadUrl: null, expiresAt: null };
  const elapsed = Date.now() - exportRequestedAtMilliseconds;
  const requestedAt = new Date(exportRequestedAtMilliseconds).toISOString();
  if (elapsed < processingAfterMilliseconds) return { status: "requested", requestedAt, downloadUrl: null, expiresAt: null };
  if (elapsed < readyAfterMilliseconds) return { status: "processing", requestedAt, downloadUrl: null, expiresAt: null };
  return { status: "ready", requestedAt, downloadUrl: "/mock/my-data-export.zip", expiresAt: new Date(exportRequestedAtMilliseconds + readyAfterMilliseconds + exportLinkLifetimeMilliseconds).toISOString() };
}

export const privacyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/consents", () => describeConsents()),
  createMockRoute("PUT", "/api/v1/users/me/consents", ({ body }) => {
    const { policyVersion, policyVersionId, consents } = body as { policyVersion?: string; policyVersionId?: string; consents?: Record<string, boolean> };
    if (policyVersionId) recordMockPolicyAcceptance(policyVersionId);
    for (const [consentType, granted] of Object.entries(consents ?? {})) {
      if (!(optionalConsentTypes as readonly string[]).includes(consentType)) throw new ApiError(400, `${consentType} is not a consent type`, "VALIDATION_FAILED");
      grantedConsentTypes.set(consentType, { granted, decidedAt: new Date().toISOString() });
    }
    if (policyVersion) consentPolicyVersion = policyVersion;
    return describeConsents();
  }),
  createMockRoute("GET", "/api/v1/users/me/data-exports", () => {
    const current = describeDataExport();
    return { data: current.status === "none" ? [] : [{ id: "export_mock", ...current }], nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/users/me/data-exports", () => {
    const { status } = describeDataExport();
    if (status === "requested" || status === "processing") throw new ApiError(409, "An export is already in progress");
    exportRequestedAtMilliseconds = Date.now();
    return { id: "export_mock", ...describeDataExport() };
  }),
  createMockRoute("POST", "/api/v1/users/me/deletion-request", ({ body }) => {
    if ((body as { confirm?: boolean }).confirm !== true) throw new ApiError(422, `Type ${deletionConfirmationWord} to confirm`);
    return { id: "deletion_mock", status: "scheduled", reason: "", requestedAt: new Date().toISOString(), scheduledFor: new Date(Date.now() + deletionGracePeriodMilliseconds).toISOString(), cancelledAt: null, executedAt: null, retentionPolicy: [] };
  }),
  createMockRoute("POST", "/api/v1/analytics/product-interactions", ({ body, headers }) => {
    const consentHeader = headers?.["x-consent-analytics"];
    const analyticsAllowed = consentHeader === "true" || (consentHeader === undefined && grantedConsentTypes.get("analytics")?.granted === true);
    const events = (body as { events?: ProductInteractionRecord[] } | null)?.events ?? [];
    if (analyticsAllowed) receivedProductInteractions.push(...events);
    return { accepted: analyticsAllowed ? events.length : 0, dropped: analyticsAllowed ? 0 : events.length };
  }),
];
