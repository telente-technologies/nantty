import type { staffRoles } from "@/constants/roles.constant";

export type StaffRole = (typeof staffRoles)[number];
export type VerificationStatus = "unverified" | "pending" | "verified" | "suspended" | "revoked";
export type GoldTier = "PRO" | "PREMIUM";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "suspended";

export interface StoreVerification {
  readonly status: VerificationStatus;
  readonly color: "GOLD";
  readonly tier: GoldTier | null;
  readonly badgeVisible: boolean;
}

export interface SubscriptionSummary {
  readonly status: SubscriptionStatus;
  readonly plan: GoldTier;
  readonly currentPeriodEnd: string | null;
}

export interface GoldEntitlements {
  readonly maxStaffSeats: number | null;
  readonly maxLocations: number | null;
  readonly reducedCommission: boolean;
  readonly priorityPlacement: boolean;
  readonly adCredits: { readonly amountMinor: number; readonly currency: string } | null;
  readonly apiAccess: boolean;
}

export interface SellerAccess {
  readonly storeId: string | null;
  readonly storeName: string | null;
  readonly verification: StoreVerification;
  readonly subscription: SubscriptionSummary | null;
  readonly entitlements: GoldEntitlements | null;
  readonly role: StaffRole | null;
}

export interface SignedInUser {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export interface PosOperator {
  readonly staffId: string;
  readonly name: string;
  readonly role: StaffRole;
}

export interface SellerSessionView {
  readonly user: SignedInUser;
  readonly access: SellerAccess;
  readonly operator: PosOperator | null;
  readonly effectiveRole: StaffRole | null;
  readonly selectedLocationId: string | null;
}

export type SellerAccessDestination = "not-seller" | "verification" | "billing" | "app";
