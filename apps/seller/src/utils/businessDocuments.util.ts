import type { BusinessDocumentKind, BusinessDocumentsOverview, BusinessDocumentsResponse } from "@/types/businessDocuments.type";

export const businessDocumentDescriptions: Record<BusinessDocumentKind, string> = {
  cac_certificate: "Your company or business name registration certificate.",
  identity: "The owner's NIN slip, passport, driver's licence or voter's card.",
  address_proof: "A recent utility bill or bank statement for your business address.",
};

export function presentBusinessDocuments(response: BusinessDocumentsResponse, hasPaidPlan: boolean): BusinessDocumentsOverview {
  const documents = response.documents.map((document) => ({ ...document, description: businessDocumentDescriptions[document.kind] ?? "" }));
  const overallStatus = response.allApproved
    ? "approved"
    : documents.some((document) => document.status === "rejected")
      ? "needs_attention"
      : documents.every((document) => document.status === "not_uploaded")
        ? "not_started"
        : "in_review";
  const goldCheckmark = overallStatus !== "approved" ? "after_approval" : hasPaidPlan ? "granted" : "needs_plan";
  return { documents, overallStatus, goldCheckmark };
}
