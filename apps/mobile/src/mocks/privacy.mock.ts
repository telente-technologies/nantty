import { ApiError } from "@/errors/api.error";
import { CURRENT_POLICY_VERSION } from "@/config/legalLinks.config";
import type { ConsentKey, ConsentRecord, DataExportRequest, ProductInteractionRecord, UpdateConsentsInput } from "@/types";
import type { ConsentsWire } from "@/services/account/consents.service";

import { recordMockPolicyAcceptance } from "./legal.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const PROCESSING_AFTER_MS = 3000;
const READY_AFTER_MS = 9000;
const EXPORT_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const DELETION_CONFIRMATION_WORD = "DELETE";

let consentRecord: ConsentRecord = {
  policyVersionId: CURRENT_POLICY_VERSION,
  consents: { personalization: true, advertising: true, analytics: true, marketing: false },
  updatedAt: new Date().toISOString(),
};
let exportRequestedAtMs: number | null = null;
let mockDeletionRequest: { id: string; status: "scheduled" | "cancelled"; reason: string; requestedAt: string; scheduledFor: string; cancelledAt: string | null; executedAt: null; retentionPolicy: readonly never[] } | null = null;
export const receivedProductInteractions: ProductInteractionRecord[] = [];

const describeDataExport = (): DataExportRequest => {
  if (exportRequestedAtMs === null) return { status: "none", requestedAt: null, downloadUrl: null, expiresAt: null };
  const elapsed = Date.now() - exportRequestedAtMs;
  const requestedAt = new Date(exportRequestedAtMs).toISOString();
  if (elapsed < PROCESSING_AFTER_MS) return { status: "requested", requestedAt, downloadUrl: null, expiresAt: null };
  if (elapsed < READY_AFTER_MS) return { status: "processing", requestedAt, downloadUrl: null, expiresAt: null };
  return {
    status: "ready",
    requestedAt,
    downloadUrl: "https://nantty.com/mock/my-data-export.zip",
    expiresAt: new Date(exportRequestedAtMs + READY_AFTER_MS + EXPORT_LINK_LIFETIME_MS).toISOString(),
  };
};

const toConsentsWire = (record: ConsentRecord): ConsentsWire => ({
  data: (Object.keys(record.consents) as ConsentKey[]).map((consentType) => ({ consentType, status: record.consents[consentType] ? "granted" : "denied", decidedAt: record.updatedAt })),
  policyVersion: record.policyVersionId,
});

export const privacyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/consents", () => toConsentsWire(consentRecord)),
  createMockRoute("PUT", "/api/v1/users/me/consents", ({ body }) => {
    const { policyVersionId, consents } = body as UpdateConsentsInput;
    if (policyVersionId) recordMockPolicyAcceptance(policyVersionId);
    consentRecord = { policyVersionId: policyVersionId ?? consentRecord.policyVersionId, consents: { ...consentRecord.consents, ...consents }, updatedAt: new Date().toISOString() };
    return toConsentsWire(consentRecord);
  }),
  createMockRoute("GET", "/api/v1/users/me/data-exports", () => {
    const current = describeDataExport();
    return { data: current.status === "none" ? [] : [{ id: "export_mock", ...current }], nextCursor: null };
  }),
  createMockRoute("POST", "/api/v1/users/me/data-exports", () => {
    if (describeDataExport().status === "requested" || describeDataExport().status === "processing") throw new ApiError(409, "An export is already in progress");
    exportRequestedAtMs = Date.now();
    return { id: "export_mock", ...describeDataExport() };
  }),
  createMockRoute("GET", "/api/v1/users/me/deletion-request", () => {
    if (!mockDeletionRequest) throw new ApiError(404, "No account deletion request found", "NOT_FOUND");
    return mockDeletionRequest;
  }),
  createMockRoute("POST", "/api/v1/users/me/deletion-request", ({ body }) => {
    if ((body as { confirm?: boolean }).confirm !== true) throw new ApiError(422, `Type ${DELETION_CONFIRMATION_WORD} to confirm`);
    mockDeletionRequest = { id: "deletion_mock", status: "scheduled", reason: "", requestedAt: new Date().toISOString(), scheduledFor: new Date(Date.now() + DELETION_GRACE_PERIOD_MS).toISOString(), cancelledAt: null, executedAt: null, retentionPolicy: [] };
    return mockDeletionRequest;
  }),
  createMockRoute("POST", "/api/v1/users/me/deletion-request/cancel", () => {
    if (!mockDeletionRequest || mockDeletionRequest.status !== "scheduled") throw new ApiError(404, "No pending deletion request found", "NOT_FOUND");
    mockDeletionRequest = { ...mockDeletionRequest, status: "cancelled", cancelledAt: new Date().toISOString() };
    return mockDeletionRequest;
  }),
  createMockRoute("POST", "/api/v1/analytics/product-interactions", ({ body }) => {
    receivedProductInteractions.push(...((body as { events: ProductInteractionRecord[] }).events ?? []));
    return undefined;
  }),
];
