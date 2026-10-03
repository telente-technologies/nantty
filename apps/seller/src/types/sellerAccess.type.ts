import type { SellerPermission } from "@/config/rolePermissions.config";
import type { staffRoles } from "@/constants/roles.constant";

export type StaffRole = (typeof staffRoles)[number];
export type VerificationStatus = "unverified" | "pending" | "verified" | "suspended" | "revoked";
export type GoldTier = "PRO" | "PREMIUM";
export type SubscriptionPlanTier = "PRO" | "BUSINESS";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired" | "suspended";

export interface StoreVerification {
  readonly status: VerificationStatus;
  readonly color: "GOLD";
  readonly tier: GoldTier | null;
  readonly badgeVisible: boolean;
}

export interface SubscriptionSummary {
  readonly status: SubscriptionStatus;
  readonly plan: SubscriptionPlanTier;
  readonly currentPeriodEnd: string | null;
}

export interface PlanEntitlements {
  readonly maxStaffSeats: number | null;
  readonly maxLocations: number | null;
  readonly reducedEscrowFee: boolean;
  readonly priorityPlacement: boolean;
  readonly adCredits: { readonly amountMinor: number; readonly currency: string } | null;
  readonly apiAccess: boolean;
}

export interface SellerAccess {
  readonly storeId: string | null;
  readonly storeName: string | null;
  readonly verification: StoreVerification;
  readonly subscription: SubscriptionSummary | null;
  readonly entitlements: PlanEntitlements | null;
  readonly role: StaffRole | null;
  readonly permissions: SellerPermission[] | null;
}

export interface SignedInUser {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export interface SellerSessionView {
  readonly user: SignedInUser;
  readonly access: SellerAccess;
  readonly effectiveRole: StaffRole | null;
  readonly selectedLocationId: string | null;
}

export type SellerAccessDestination = "not-seller" | "restricted" | "app";
