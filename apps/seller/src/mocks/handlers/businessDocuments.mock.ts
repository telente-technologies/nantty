import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { BusinessDocumentKind, BusinessDocumentsOverview, BusinessDocumentView } from "@/types/businessDocuments.type";

const kinds: readonly BusinessDocumentKind[] = ["cac_certificate", "government_id", "proof_of_address"];
const labels: Record<BusinessDocumentKind, { label: string; description: string }> = {
  cac_certificate: { label: "CAC certificate", description: "Your company or business name registration certificate." },
  government_id: { label: "Government ID", description: "The owner's NIN slip, passport, driver's licence or voter's card." },
  proof_of_address: { label: "Proof of address", description: "A recent utility bill or bank statement for your business address." },
};
const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
const maximumBytes = 10 * 1024 * 1024;

const holder = globalThis as typeof globalThis & { __zudomartSellerBusinessDocuments?: Map<string, BusinessDocumentView[]> };

function blank(kind: BusinessDocumentKind): BusinessDocumentView {
  return { kind, ...labels[kind], status: "not_uploaded", fileName: null, uploadedAt: null, rejectionReason: null };
}

function seed(storeId: string): BusinessDocumentView[] {
  const uploaded = (kind: BusinessDocumentKind, status: BusinessDocumentView["status"], fileName: string, rejectionReason: string | null = null): BusinessDocumentView => ({ ...blank(kind), status, fileName, uploadedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), rejectionReason });
  if (storeId === "store_kelechi_kicks") return [uploaded("cac_certificate", "rejected", "business-permit.jpg", "This looks like a local permit, not your CAC registration certificate. Please upload the certificate."), uploaded("government_id", "approved", "nin-slip.pdf"), uploaded("proof_of_address", "in_review", "bill.pdf")];
  if (storeId === "store_funmi_bakes") return kinds.map(blank);
  return [uploaded("cac_certificate", "approved", "cac.pdf"), uploaded("government_id", "approved", "id.jpg"), uploaded("proof_of_address", "approved", "bill.pdf")];
}

function readDocuments(storeId: string): BusinessDocumentView[] {
  const map = (holder.__zudomartSellerBusinessDocuments ??= new Map());
  if (!map.has(storeId)) map.set(storeId, seed(storeId));
  return map.get(storeId) as BusinessDocumentView[];
}

function present(storeId: string): BusinessDocumentsOverview {
  const documents = readDocuments(storeId);
  const overallStatus = documents.every((item) => item.status === "approved") ? "approved" : documents.some((item) => item.status === "rejected") ? "needs_attention" : documents.every((item) => item.status === "not_uploaded") ? "not_started" : "in_review";
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  const hasPaidPlan = gateStore?.subscription.subscription?.status === "active" || gateStore?.subscription.subscription?.status === "trialing";
  const goldCheckmark = overallStatus !== "approved" ? "after_approval" : hasPaidPlan ? "granted" : "needs_plan";
  return { documents, overallStatus, goldCheckmark, neverBlocksSelling: true };
}

export function registerBusinessDocumentMockHandlers(): void {
  registerMockRoute("GET", "/seller/business-documents", (request) => respondWithJson(200, present(requireMockStorePrincipal(request).storeId)));

  registerMockRoute("POST", "/seller/business-documents/:kind", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const kind = kinds.find((candidate) => candidate === request.params.kind);
    if (!kind) throw new MockHttpError(404, "UNKNOWN_DOCUMENT", "That document type does not exist.");
    const body = readJsonObjectBody(request);
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    if (!fileName) throw new MockHttpError(400, "INVALID_FILE", "Choose a file to upload.");
    if (!allowedMimeTypes.includes(mimeType)) throw new MockHttpError(400, "INVALID_FILE", "Upload a PDF, JPEG or PNG file.");
    if (sizeBytes <= 0 || sizeBytes > maximumBytes) throw new MockHttpError(400, "INVALID_FILE", "Files can be up to 10 MB.");
    const documents = readDocuments(storeId);
    const index = documents.findIndex((item) => item.kind === kind);
    if (documents[index]?.status === "approved") throw new MockHttpError(409, "ALREADY_APPROVED", "This document is already approved.");
    documents[index] = { ...blank(kind), status: "in_review", fileName, uploadedAt: new Date().toISOString() };
    return respondWithJson(200, present(storeId));
  });
}
