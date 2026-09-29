import type { AuditLogEntry } from "@/types/audit.type";
import type { IpClaimSummary } from "@/types/ipClaims.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type BrandStatus = "ACTIVE" | "SUSPENDED";
export type OfficialStoreStatus = "NONE" | "PENDING" | "NEEDS_INFO" | "OFFICIAL" | "REJECTED" | "REVOKED";
export type BrandMemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type BrandDocumentKind = "TRADEMARK_CERTIFICATE" | "CAC_CERTIFICATE" | "AUTHORIZATION_LETTER";
export type AutomatedCheckOutcome = "PASS" | "WARN" | "FAIL";
export type OfficialStoreDecisionAction = "approve" | "reject" | "request-info" | "revoke";

export interface BrandSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logoUrl: string | null;
  readonly category: string;
  readonly country: string;
  readonly website: string | null;
  readonly status: BrandStatus;
  readonly officialStatus: OfficialStoreStatus;
  readonly owner: PlatformUserSummary | null;
  readonly memberCount: number;
  readonly linkedStoreCount: number;
  readonly openClaimCount: number;
  readonly createdAt: string;
  readonly officialRequestSubmittedAt: string | null;
}

export interface BrandMember {
  readonly user: PlatformUserSummary;
  readonly role: BrandMemberRole;
  readonly addedAt: string;
}

export interface BrandLinkedStore {
  readonly id: string;
  readonly storeName: string;
  readonly seller: PlatformUserSummary;
  readonly linkedAt: string;
  readonly isVerified: boolean;
  readonly hasOfficialBadge: boolean;
}

export interface TrademarkRegistration {
  readonly registrationNumber: string;
  readonly jurisdiction: string;
  readonly niceClass: number;
  readonly registeredOwner: string;
  readonly registeredOn: string;
  readonly expiresOn: string;
}

export interface BrandDocumentSummary {
  readonly id: string;
  readonly kind: BrandDocumentKind;
  readonly label: string;
  readonly uploadedAt: string;
}

export interface OfficialStoreAutomatedCheck {
  readonly key: string;
  readonly label: string;
  readonly outcome: AutomatedCheckOutcome;
  readonly detail: string;
}

export interface OfficialStoreRequest {
  readonly id: string;
  readonly submittedAt: string;
  readonly submittedBy: PlatformUserSummary | null;
  readonly trademark: TrademarkRegistration;
  readonly cacRegistrationNumber: string;
  readonly cacCompanyName: string;
  readonly contactEmail: string;
  readonly documents: readonly BrandDocumentSummary[];
  readonly checks: readonly OfficialStoreAutomatedCheck[];
  readonly lastDecisionReason: string | null;
  readonly decidedAt: string | null;
  readonly decidedByName: string | null;
}

export interface BrandDetail extends BrandSummary {
  readonly description: string;
  readonly members: readonly BrandMember[];
  readonly linkedStores: readonly BrandLinkedStore[];
  readonly officialRequest: OfficialStoreRequest | null;
  readonly allowedOfficialActions: readonly OfficialStoreDecisionAction[];
  readonly claimsFiled: readonly IpClaimSummary[];
  readonly history: readonly AuditLogEntry[];
}

export interface BrandDocumentAccess {
  readonly documentId: string;
  readonly kind: BrandDocumentKind;
  readonly url: string;
  readonly expiresAt: string;
  readonly watermarkText: string;
}
