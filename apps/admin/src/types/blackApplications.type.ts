import type { PlatformUserSummary } from "@/types/platformUser.type";

export type BlackChecklistKey = "LETTERHEAD_LETTER" | "OFFICIAL_CHANNEL" | "REPRESENTATIVE" | "ENTITY_PROOF";
export type BlackApplicationStatus = "IN_REVIEW" | "AWAITING_SECOND_APPROVAL" | "APPROVED" | "REJECTED" | "REVOKED";

export interface BlackChecklistItem {
  readonly key: BlackChecklistKey;
  readonly label: string;
  readonly detail: string;
  readonly isVerified: boolean;
  readonly note: string | null;
  readonly verifiedByName: string | null;
}

export interface BlackApproval {
  readonly adminId: string;
  readonly name: string;
  readonly at: string;
}

export interface BlackApplication {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly agencyName: string;
  readonly handle: string;
  readonly representativeName: string;
  readonly representativeRole: string;
  readonly status: BlackApplicationStatus;
  readonly submittedAt: string;
  readonly checklist: readonly BlackChecklistItem[];
  readonly firstApproval: BlackApproval | null;
  readonly secondApproval: BlackApproval | null;
  readonly decisionReason: string | null;
  readonly reverificationDueAt: string | null;
  readonly reverificationRemindedAt: string | null;
  readonly handleReserved: boolean;
}
