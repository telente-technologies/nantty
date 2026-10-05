import type { Money } from "@/types/money.type";

export type AdAccountKind = "personal" | "business";
export type AdAccountRole = "admin" | "advertiser" | "analyst" | "billing";
export type AdAccountStatus = "active" | "disabled" | "pending_review";

export interface AdsUser {
  readonly id: string;
  readonly name: string | null;
  readonly username: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export interface LinkedBusinessProfile {
  readonly storeId: string;
  readonly storeName: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly goldVerified: boolean;
  readonly countryCode: string;
}

export interface AdAccountSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: AdAccountKind;
  readonly currency: string;
  readonly timezone: string;
  readonly countryCode: string;
  readonly status: AdAccountStatus;
  readonly myRole: AdAccountRole;
  readonly verifiedBusiness: boolean;
  readonly business: LinkedBusinessProfile | null;
  readonly balance: Money;
  readonly activeCampaignCount: number;
}

export interface AdAccount extends AdAccountSummary {
  readonly createdAt: string;
  readonly owner: { readonly id: string; readonly name: string };
  readonly amountSpent: Money;
  readonly disabledReason: string | null;
}

export interface AdAccountMembership {
  readonly accountId: string;
  readonly role: AdAccountRole;
}

export interface AdAccountMember {
  readonly userId: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly role: AdAccountRole;
  readonly addedAt: string;
  readonly lastActiveAt: string | null;
  readonly isOwner: boolean;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface AdAccountInvite {
  readonly id: string;
  readonly email?: string;
  readonly username?: string;
  readonly role: AdAccountRole;
  readonly invitedBy: string;
  readonly status: InviteStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface InvitePreview {
  readonly accountName: string;
  readonly role: AdAccountRole;
  readonly invitedBy: string;
  readonly expiresAt: string;
}

export interface CreateAdAccountRequest {
  readonly name: string;
  readonly kind: AdAccountKind;
  readonly storeId: string | null;
  readonly countryCode: string;
  readonly timezone: string;
}

export interface UpdateAdAccountRequest {
  readonly name?: string;
  readonly timezone?: string;
}

export interface AdsEntitlements {
  readonly goldPremium: boolean;
  readonly verifiedBusiness: boolean;
  readonly monthlyAdCredit: Money | null;
  readonly creditRenewsAt: string | null;
}
