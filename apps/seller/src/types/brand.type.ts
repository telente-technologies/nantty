import type { Money } from "@/types/money.type";
import type { GoldTier, StaffRole, SubscriptionPlanTier, SubscriptionStatus, VerificationStatus } from "@/types/sellerAccess.type";

export type BrandRegistrationStatus = "unregistered" | "pending" | "registered" | "rejected";
export type OfficialStoreStatus = "not_eligible" | "eligible" | "active" | "suspended";
export type BrandMemberRole = "owner" | "admin" | "editor" | "viewer";
export type ProductBrandRelationship = "own" | "authorised_reseller" | "genuine_resale";
export type BrandClaimKind = "counterfeit" | "trademark" | "unauthorised_seller";
export type BrandClaimStatus = "submitted" | "under_review" | "upheld" | "rejected" | "withdrawn";

export interface BrandRegistration {
  readonly status: BrandRegistrationStatus;
  readonly trademarkNumber: string | null;
  readonly registeredAt: string | null;
  readonly note: string | null;
}

export interface BrandGoldVerification {
  readonly status: VerificationStatus;
  readonly tier: GoldTier | null;
  readonly badgeVisible: boolean;
}

export interface BrandOfficialStore {
  readonly status: OfficialStoreStatus;
  readonly storeId: string | null;
  readonly reason: string | null;
}

export interface BrandMember {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly username: string;
  readonly role: BrandMemberRole;
  readonly status: "invited" | "active";
}

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly description: string;
  readonly website: string | null;
  readonly country: string;
  readonly registration: BrandRegistration;
  readonly verification: BrandGoldVerification;
  readonly officialStore: BrandOfficialStore;
  readonly members: BrandMember[];
  readonly storeIds: string[];
  readonly sellingEnabled?: boolean;
}

export interface BrandSummary {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly registrationStatus: BrandRegistrationStatus;
  readonly officialStoreStatus: OfficialStoreStatus;
  readonly myRole: BrandMemberRole;
  readonly storeCount: number;
}

export interface BrandDirectoryEntry {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly isOfficial: boolean;
  readonly isMine: boolean;
}

export interface ProductBrandTag {
  readonly brandId: string;
  readonly name: string;
  readonly relationship: ProductBrandRelationship;
}

export interface OfficialStoreRequirement {
  readonly key: "brand_registered" | "store_gold_verified" | "gold_plan_active" | "no_open_trademark_disputes" | "store_linked";
  readonly label: string;
  readonly met: boolean;
  readonly howToFix: string;
}

export interface OfficialStoreDetails {
  readonly officialStore: BrandOfficialStore;
  readonly requirements: OfficialStoreRequirement[];
  readonly candidateStoreId: string | null;
}

export interface BrandListingReport {
  readonly id: string;
  readonly sellerName: string;
  readonly sellerHandle: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly price: Money;
  readonly yourRecommendedPrice: Money | null;
  readonly priceDifferenceBasisPoints: number | null;
  readonly relationshipClaimed: ProductBrandRelationship;
  readonly risk: "low" | "medium" | "high";
  readonly riskReasons: string[];
  readonly listedAt: string;
  readonly openClaimId: string | null;
}

export interface BrandClaim {
  readonly id: string;
  readonly brandId: string;
  readonly kind: BrandClaimKind;
  readonly listings: { readonly listingId: string; readonly title: string; readonly sellerHandle: string }[];
  readonly evidence: string;
  readonly status: BrandClaimStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolution: string | null;
}

export interface MyStoreEntry {
  readonly storeId: string;
  readonly storeName: string;
  readonly brandId: string | null;
  readonly role: StaffRole;
  readonly verification: { readonly status: VerificationStatus; readonly tier: GoldTier | null; readonly badgeVisible: boolean };
  readonly subscription: { readonly status: SubscriptionStatus; readonly plan: SubscriptionPlanTier } | null;
  readonly isCurrent: boolean;
}
