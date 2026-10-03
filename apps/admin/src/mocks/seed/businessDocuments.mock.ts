import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { BusinessDocumentItem, BusinessDocumentKind, BusinessDocumentStatus, BusinessDocumentStorePlan } from "@/types/businessDocuments.type";

export interface MockBusinessSubmissionRecord {
  readonly id: string;
  readonly userId: string;
  readonly storeName: string;
  plan: BusinessDocumentStorePlan;
  readonly submittedAt: string;
  readonly documents: BusinessDocumentItem[];
  goldGranted: boolean;
}

const dayMinutes = 1440;

function document(submissionId: string, kind: BusinessDocumentKind, fileName: string, status: BusinessDocumentStatus, uploadedMinutesAgo: number, rejectionReason: string | null = null): BusinessDocumentItem {
  return { id: `${submissionId}_${kind.toLowerCase()}`, kind, fileName, uploadedAt: isoMinutesAgo(uploadedMinutesAgo), status, rejectionReason, reviewedByName: status === "PENDING" ? null : "Chidi Okafor", reviewedAt: status === "PENDING" ? null : isoMinutesAgo(uploadedMinutesAgo - 600) };
}

export function buildDemoBusinessSubmissions(): MockBusinessSubmissionRecord[] {
  return [
    { id: "bdoc_0001", userId: "usr_0004", storeName: "Chioma Threads", plan: "PRO", submittedAt: isoMinutesAgo(5 * dayMinutes), goldGranted: false, documents: [document("bdoc_0001", "CAC_CERTIFICATE", "cac-chioma-threads.pdf", "PENDING", 5 * dayMinutes), document("bdoc_0001", "ID", "nin-slip.jpg", "PENDING", 5 * dayMinutes), document("bdoc_0001", "PROOF_OF_ADDRESS", "ikeja-electric-bill.pdf", "PENDING", 5 * dayMinutes)] },
    { id: "bdoc_0002", userId: "usr_0019", storeName: "Halima Hijabs", plan: "BUSINESS", submittedAt: isoMinutesAgo(2 * dayMinutes), goldGranted: false, documents: [document("bdoc_0002", "CAC_CERTIFICATE", "cac-halima.pdf", "PENDING", 2 * dayMinutes), document("bdoc_0002", "ID", "drivers-licence.jpg", "APPROVED", 2 * dayMinutes), document("bdoc_0002", "PROOF_OF_ADDRESS", "bank-statement.pdf", "PENDING", 2 * dayMinutes)] },
    { id: "bdoc_0003", userId: "usr_0014", storeName: "Musa Motors", plan: "FREE", submittedAt: isoMinutesAgo(dayMinutes), goldGranted: false, documents: [document("bdoc_0003", "CAC_CERTIFICATE", "cac-musa-motors.pdf", "PENDING", dayMinutes), document("bdoc_0003", "ID", "passport.jpg", "PENDING", dayMinutes), document("bdoc_0003", "PROOF_OF_ADDRESS", "utility-bill.pdf", "PENDING", dayMinutes)] },
    { id: "bdoc_0004", userId: "usr_0008", storeName: "Wanjiru Home", plan: "PRO", submittedAt: isoMinutesAgo(8 * dayMinutes), goldGranted: false, documents: [document("bdoc_0004", "CAC_CERTIFICATE", "business-permit.jpg", "REJECTED", 8 * dayMinutes, "This is a county permit, not a company registration certificate. Upload the registration certificate."), document("bdoc_0004", "ID", "national-id.jpg", "APPROVED", 8 * dayMinutes), document("bdoc_0004", "PROOF_OF_ADDRESS", "kplc-bill.pdf", "APPROVED", 8 * dayMinutes)] },
  ];
}
