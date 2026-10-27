import { createMockIdentifier, MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { BusinessDocumentKind, BusinessDocumentRecord, BusinessDocumentsResponse, BusinessDocumentUploadIntent } from "@/types/businessDocuments.type";

const kinds: readonly BusinessDocumentKind[] = ["cac_certificate", "identity", "address_proof"];
const labels: Record<BusinessDocumentKind, string> = { cac_certificate: "CAC certificate", identity: "Government ID", address_proof: "Proof of address" };
const allowedContentTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const maximumBytes = 10 * 1024 * 1024;

interface MockUploadIntent {
  readonly storeId: string;
  readonly kind: BusinessDocumentKind;
  readonly sizeBytes: number;
  isUploaded: boolean;
}

const holder = globalThis as typeof globalThis & { __nanttySellerBusinessDocuments?: Map<string, BusinessDocumentRecord[]>; __nanttySellerDocumentIntents?: Map<string, MockUploadIntent> };

function blank(kind: BusinessDocumentKind): BusinessDocumentRecord {
  return { kind, label: labels[kind], status: "not_uploaded", fileUrl: null, rejectionReason: null, submittedAt: null };
}

function seed(storeId: string): BusinessDocumentRecord[] {
  const uploaded = (kind: BusinessDocumentKind, status: BusinessDocumentRecord["status"], rejectionReason: string | null = null): BusinessDocumentRecord => ({ ...blank(kind), status, submittedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), rejectionReason });
  if (storeId === "store_kelechi_kicks") return [uploaded("cac_certificate", "rejected", "This looks like a local permit, not your CAC registration certificate. Please upload the certificate."), uploaded("identity", "approved"), uploaded("address_proof", "pending")];
  if (storeId === "store_funmi_bakes") return kinds.map(blank);
  return [uploaded("cac_certificate", "approved"), uploaded("identity", "approved"), uploaded("address_proof", "approved")];
}

function readDocuments(storeId: string): BusinessDocumentRecord[] {
  const map = (holder.__nanttySellerBusinessDocuments ??= new Map());
  if (!map.has(storeId)) map.set(storeId, seed(storeId));
  return map.get(storeId) as BusinessDocumentRecord[];
}

function readIntents(): Map<string, MockUploadIntent> {
  return (holder.__nanttySellerDocumentIntents ??= new Map());
}

function present(storeId: string): BusinessDocumentsResponse {
  const documents = readDocuments(storeId);
  return { documents, allApproved: documents.every((item) => item.status === "approved") };
}

function requireKind(candidate: string | undefined): BusinessDocumentKind {
  const kind = kinds.find((known) => known === candidate);
  if (!kind) throw new MockHttpError(404, "NOT_FOUND", "That document type does not exist.");
  return kind;
}

export function registerBusinessDocumentMockHandlers(): void {
  registerMockRoute("GET", "/seller/business-documents", (request) => respondWithJson(200, present(requireMockStorePrincipal(request).storeId)));

  registerMockRoute("POST", "/seller/business-documents/:kind/upload-intents", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const kind = requireKind(request.params.kind);
    const body = readJsonObjectBody(request);
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    if (!allowedContentTypes.includes(contentType) || sizeBytes <= 0 || sizeBytes > maximumBytes) throw new MockHttpError(400, "VALIDATION_FAILED", "Upload a PDF, JPEG, PNG or WebP file of at most 10 MB.");
    if (!fileName || fileName.length > 200) throw new MockHttpError(400, "VALIDATION_FAILED", "Choose a file to upload.");
    if (readDocuments(storeId).find((item) => item.kind === kind)?.status === "approved") throw new MockHttpError(409, "ALREADY_APPROVED", "This document was already approved.");
    const documentId = createMockIdentifier("doc");
    readIntents().set(documentId, { storeId, kind, sizeBytes, isUploaded: false });
    const intent: BusinessDocumentUploadIntent = {
      documentId,
      objectKey: `business-documents/${storeId}/${kind}/${documentId}`,
      uploadUrl: `/bff/seller/business-documents/${kind}/uploads/${documentId}`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    return respondWithJson(201, intent);
  });

  registerMockRoute("PUT", "/seller/business-documents/:kind/uploads/:documentId", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const intent = readIntents().get(request.params.documentId ?? "");
    if (!intent || intent.storeId !== storeId || intent.kind !== requireKind(request.params.kind)) throw new MockHttpError(404, "NOT_FOUND", "Request an upload link first.");
    if ((request.binaryBody?.byteLength ?? 0) === 0) throw new MockHttpError(400, "VALIDATION_FAILED", "The file is empty.");
    intent.isUploaded = true;
    return respondWithNoContent();
  });

  registerMockRoute("PUT", "/seller/business-documents/:kind", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const kind = requireKind(request.params.kind);
    const body = readJsonObjectBody(request);
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const intent = readIntents().get(documentId);
    if (!intent || intent.storeId !== storeId || intent.kind !== kind) throw new MockHttpError(404, "NOT_FOUND", "Request an upload link first.");
    if (!intent.isUploaded) throw new MockHttpError(409, "UPLOAD_MISSING", "The file has not been uploaded yet.");
    readIntents().delete(documentId);
    const documents = readDocuments(storeId);
    const index = documents.findIndex((item) => item.kind === kind);
    documents[index] = { ...blank(kind), status: "pending", submittedAt: new Date().toISOString() };
    return respondWithJson(200, present(storeId));
  });
}
