import { ApiError } from "@/errors/api.error";
import { CURRENT_POLICY_VERSION } from "@/config/legalLinks.config";
import type { ConsentRecord, DataExportRequest, ProductInteractionRecord, UpdateConsentsInput } from "@/types";

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
    downloadUrl: "https://zudomart.com/mock/my-data-export.zip",
    expiresAt: new Date(exportRequestedAtMs + READY_AFTER_MS + EXPORT_LINK_LIFETIME_MS).toISOString(),
  };
};

export const privacyMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/consents", () => consentRecord),
  createMockRoute("PUT", "/api/v1/users/me/consents", ({ body }) => {
    const { policyVersionId, consents } = body as UpdateConsentsInput;
    if (!policyVersionId) throw new ApiError(422, "policyVersionId is required");
    recordMockPolicyAcceptance(policyVersionId);
    consentRecord = { policyVersionId, consents: { ...consentRecord.consents, ...consents }, updatedAt: new Date().toISOString() };
    return consentRecord;
  }),
  createMockRoute("GET", "/api/v1/privacy/exports/latest", () => describeDataExport()),
  createMockRoute("POST", "/api/v1/privacy/exports", () => {
    if (describeDataExport().status === "requested" || describeDataExport().status === "processing") throw new ApiError(409, "An export is already in progress");
    exportRequestedAtMs = Date.now();
    return describeDataExport();
  }),
  createMockRoute("POST", "/api/v1/privacy/deletion", ({ body }) => {
    if ((body as { confirmation?: string }).confirmation !== DELETION_CONFIRMATION_WORD) throw new ApiError(422, `Type ${DELETION_CONFIRMATION_WORD} to confirm`);
    return { scheduledFor: new Date(Date.now() + DELETION_GRACE_PERIOD_MS).toISOString() };
  }),
  createMockRoute("POST", "/api/v1/analytics/product-interactions", ({ body }) => {
    receivedProductInteractions.push(...((body as { events: ProductInteractionRecord[] }).events ?? []));
    return undefined;
  }),
];
