import type { staffRoles } from "@/constants/roles.constant";

export type StaffRole = (typeof staffRoles)[number];
export type VerificationStatus = "none" | "pending" | "verified" | "rejected";
export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionSummary {
  readonly status: SubscriptionStatus;
  readonly plan: { readonly id: string; readonly name: string } | null;
  readonly currentPeriodEnd: string | null;
}

export interface SellerAccess {
  readonly storeId: string | null;
  readonly storeName: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly subscription: SubscriptionSummary;
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
