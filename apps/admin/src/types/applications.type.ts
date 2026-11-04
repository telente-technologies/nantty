import type { Money } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type ApplicationKind = "sellers" | "creators";
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface EligibilityCheck {
  readonly key: string;
  readonly label: string;
  readonly isMet: boolean;
  readonly actual: string | number;
  readonly required: string | number;
}

export interface ProgramApplication {
  readonly id: string;
  readonly kind: ApplicationKind;
  readonly user: PlatformUserSummary;
  readonly status: ApplicationStatus;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedByName: string | null;
  readonly decisionReason: string | null;
  readonly pitch: string;
  readonly storeName: string | null;
  readonly logisticsEnabled: boolean;
  readonly categories: readonly string[];
  readonly expectedMonthlySales: Money | null;
  readonly contentNiche: string | null;
  readonly eligibility: readonly EligibilityCheck[];
  readonly isEligible: boolean;
}

export interface ProgramApplicationDetail extends ProgramApplication {
  readonly history: readonly AuditLogEntry[];
}
