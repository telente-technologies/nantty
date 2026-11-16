import type { PlatformUserSummary } from "@/types/platformUser.type";

export type BlackChecklistKey = "LETTERHEAD_LETTER" | "OFFICIAL_CHANNEL" | "REPRESENTATIVE" | "ENTITY_PROOF";
export type BlackApplicationStatus = "PENDING" | "IN_REVIEW" | "AWAITING_SECOND_APPROVAL" | "APPROVED" | "REVERIFICATION_REQUIRED" | "REJECTED" | "REVOKED";

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
  readonly legalIdentityName?: string;
  readonly legalRegistrationRef?: string;
  readonly jurisdictionCountryCode: string;
  readonly officialWebsite?: string;
  readonly officialContactPhone?: string;
  readonly institutionalEmail: string;
  readonly institutionalEmailVerified: boolean;
  readonly institutionalEmailVerifiedAt?: string | null;
  readonly representativeName: string;
  readonly representativeRole: string;
  readonly representativeEmail?: string;
  readonly representativeIdRef?: string;
  readonly evidenceNotes?: string;
  readonly status: BlackApplicationStatus;
  readonly submittedAt: string;
  readonly checklist: readonly BlackChecklistItem[];
  readonly firstApproval: BlackApproval | null;
  readonly secondApproval: BlackApproval | null;
  readonly decisionReason: string | null;
  readonly privateCheckoutEnabled: boolean;
  readonly privateCheckoutExpiresAt?: string | null;
  readonly reverificationDueAt: string | null;
  readonly reverificationRemindedAt: string | null;
  readonly reverificationReason?: string | null;
  readonly handleReserved: boolean;
}

export interface BlackAppeal {
  readonly id: string;
  readonly applicationId: string;
  readonly profileId: string;
  readonly reason: string;
  readonly supportingDetails?: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly decidedByStaffId?: string;
  readonly decisionNote?: string;
  readonly decidedAt?: string;
  readonly createdAt: string;
}

export interface AdminGovernmentBlackSummary {
  readonly subscription: {
    readonly subscriptionId: string;
    readonly profileId: string;
    readonly status: string;
    readonly pausedReason?: string;
    readonly cardLabel?: string;
    readonly billingAuthorizationId?: string;
    readonly cardUsable: boolean;
    readonly currentPeriodEnd?: string | null;
    readonly nextChargeAt?: string | null;
    readonly cancelAtPeriodEnd: boolean;
    readonly price: { readonly amountMinor: number; readonly currency: string };
  };
  readonly verification?: {
    readonly applicationId: string;
    readonly agencyName: string;
    readonly handle: string;
    readonly status: string;
    readonly jurisdictionCountryCode: string;
    readonly institutionalEmail: string;
    readonly institutionalEmailVerified: boolean;
    readonly privateCheckoutEnabled: boolean;
  };
  readonly recentPeriods: readonly {
    readonly id: string;
    readonly kind: string;
    readonly status: string;
    readonly invoiceNumber: string;
    readonly amount: { readonly amountMinor: number; readonly currency: string };
    readonly failureReason?: string;
  }[];
  readonly recentEvents: readonly {
    readonly id: string;
    readonly eventKind: string;
    readonly summary: string;
    readonly createdAt: string;
  }[];
}
