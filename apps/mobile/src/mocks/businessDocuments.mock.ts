import { ApiError } from "@/errors/api.error";
import type { BusinessDocument, BusinessDocumentKind, BusinessDocumentsState } from "@/types/trust.type";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const DOCUMENT_LABELS: Record<BusinessDocumentKind, string> = {
  cac_certificate: "CAC certificate",
  identity: "Government ID",
  address_proof: "Proof of address",
};

const emptyDocument = (kind: BusinessDocumentKind): BusinessDocument => ({ kind, label: DOCUMENT_LABELS[kind], status: "not_uploaded", fileUrl: null, rejectionReason: null, submittedAt: null });

const adminReviewQueue: { userId: string; kind: BusinessDocumentKind; submittedAt: string }[] = [];

const documentsByUserId = new Map<string, BusinessDocument[]>([
  ["u_me", [
    { ...emptyDocument("cac_certificate"), status: "approved", fileUrl: "mock://cac.jpg", submittedAt: isoDateHoursAgo(900) },
    { ...emptyDocument("identity"), status: "pending", fileUrl: "mock://id.jpg", submittedAt: isoDateHoursAgo(20) },
    { ...emptyDocument("address_proof"), status: "rejected", fileUrl: "mock://bill.jpg", submittedAt: isoDateHoursAgo(300), rejectionReason: "The utility bill is older than 3 months. Upload a recent one." },
  ]],
]);

const documentsOfSignedInUser = () => {
  const userId = getSignedInMockUser().id;
  if (!documentsByUserId.has(userId)) documentsByUserId.set(userId, (Object.keys(DOCUMENT_LABELS) as BusinessDocumentKind[]).map(emptyDocument));
  return documentsByUserId.get(userId)!;
};

const buildState = (): BusinessDocumentsState => {
  const documents = documentsOfSignedInUser();
  return { documents, allApproved: documents.every((document) => document.status === "approved") };
};

export const businessDocumentsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/seller/business-documents", buildState),
  createMockRoute("PUT", "/api/v1/seller/business-documents/:kind", ({ params, body }) => {
    const kind = params.kind as BusinessDocumentKind;
    const { fileUrl } = body as { fileUrl?: string };
    if (!(kind in DOCUMENT_LABELS)) throw new ApiError(404, "Unknown document type");
    if (!fileUrl) throw new ApiError(422, "Add a photo of the document");
    const submittedAt = new Date().toISOString();
    const documents = documentsOfSignedInUser();
    documentsByUserId.set(getSignedInMockUser().id, documents.map((document) => (document.kind === kind ? { ...document, status: "pending", fileUrl, rejectionReason: null, submittedAt } : document)));
    adminReviewQueue.push({ userId: getSignedInMockUser().id, kind, submittedAt });
    return buildState();
  }),
];
