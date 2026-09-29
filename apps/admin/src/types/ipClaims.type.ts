import type { Money } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { OfficialStoreStatus } from "@/types/brands.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type IpClaimType = "TRADEMARK" | "COUNTERFEIT";
export type IpClaimStatus = "OPEN" | "NEEDS_INFO" | "UPHELD" | "REJECTED";
export type IpClaimDecisionAction = "uphold" | "reject" | "request-info";
export type IpClaimEvidenceKind = "TEST_PURCHASE_PHOTO" | "SIDE_BY_SIDE" | "REGISTRATION_REFERENCE" | "NOTE";

export interface IpClaimListingPreview {
  readonly id: string;
  readonly title: string;
  readonly price: Money;
  readonly imageUrl: string;
  readonly listingUrl: string;
  readonly storeName: string;
  readonly status: "LIVE" | "DELISTED";
}

export interface IpClaimBrandReference {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly officialStatus: OfficialStoreStatus;
}

export interface IpClaimSummary {
  readonly id: string;
  readonly type: IpClaimType;
  readonly status: IpClaimStatus;
  readonly claimantBrand: IpClaimBrandReference;
  readonly accusedSeller: PlatformUserSummary;
  readonly listing: IpClaimListingPreview;
  readonly filedAt: string;
  readonly slaDueAt: string;
  readonly priorStrikeCount: number;
}

export interface IpClaimEvidence {
  readonly id: string;
  readonly kind: IpClaimEvidenceKind;
  readonly caption: string;
  readonly imageUrl: string | null;
}

export interface IpClaimSellerResponse {
  readonly submittedAt: string;
  readonly statement: string;
}

export interface IpClaimDecision {
  readonly outcome: "UPHELD" | "REJECTED" | "NEEDS_INFO";
  readonly reason: string;
  readonly decidedAt: string;
  readonly decidedByName: string;
  readonly strikeAdded: boolean;
}

export interface IpClaimDetail extends IpClaimSummary {
  readonly statement: string;
  readonly trademarkReference: string | null;
  readonly evidence: readonly IpClaimEvidence[];
  readonly sellerResponse: IpClaimSellerResponse | null;
  readonly sellerPriorStrikes: readonly { readonly policy: string; readonly issuedAt: string }[];
  readonly decision: IpClaimDecision | null;
  readonly allowedActions: readonly IpClaimDecisionAction[];
  readonly history: readonly AuditLogEntry[];
}
