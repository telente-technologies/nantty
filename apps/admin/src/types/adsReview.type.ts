import type { Money } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type AdReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PolicySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AdPolicyCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: PolicySeverity;
  readonly isActive: boolean;
  readonly rejectionCount: number;
}

export interface AdAutoCheckFlag {
  readonly policyCategoryId: string;
  readonly label: string;
  readonly severity: PolicySeverity;
  readonly detail: string;
}

export interface AdForReview {
  readonly id: string;
  readonly campaignName: string;
  readonly advertiser: { readonly id: string; readonly name: string; readonly status: AdvertiserStatus };
  readonly isBoostedPost: boolean;
  readonly creative: { readonly format: "IMAGE" | "VIDEO" | "CAROUSEL"; readonly imageUrl: string; readonly headline: string; readonly primaryText: string; readonly callToAction: string; readonly landingUrl: string };
  readonly targeting: { readonly countries: readonly string[]; readonly ageRange: string; readonly interests: readonly string[]; readonly placements: readonly string[] };
  readonly dailyBudget: Money;
  readonly totalBudget: Money | null;
  readonly schedule: { readonly startsAt: string; readonly endsAt: string | null };
  readonly autoCheckFlags: readonly AdAutoCheckFlag[];
  readonly status: AdReviewStatus;
  readonly submittedAt: string;
  readonly decision: { readonly policyCategoryId: string | null; readonly reason: string; readonly decidedByName: string; readonly decidedAt: string } | null;
}

export interface AdForReviewDetail extends AdForReview {
  readonly history: readonly AuditLogEntry[];
}

export interface AdFrequencyPolicy {
  readonly format: string;
  readonly sessionCap: number;
  readonly hourCap: number;
  readonly dayCap: number;
  readonly advertiserDayCap: number;
  readonly minGapSlots: number;
  readonly cooldownSecondsAfterSkip: number;
  readonly active: boolean;
}

export interface AdPoliciesDocument {
  readonly frequency: readonly AdFrequencyPolicy[];
}

export type AdvertiserStatus = "ACTIVE" | "SUSPENDED";

export interface AdvertiserAccount {
  readonly id: string;
  readonly name: string;
  readonly owner: PlatformUserSummary;
  readonly status: AdvertiserStatus;
  readonly country: string;
  readonly currency: string;
  readonly spendByCurrency: readonly Money[];
  readonly activeCampaigns: number;
  readonly violationCount: number;
  readonly lastViolationAt: string | null;
  readonly createdAt: string;
}

export interface AdvertiserAccountDetail extends AdvertiserAccount {
  readonly history: readonly AuditLogEntry[];
}
