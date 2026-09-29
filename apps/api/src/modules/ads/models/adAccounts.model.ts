import type { CurrencyCode } from "../../../enums/currency.enum.js";

export type AdAccountKind = "personal" | "business";
export type AdAccountRole = "admin" | "advertiser" | "analyst" | "billing";
export type AdAccountStatus = "active" | "disabled" | "pending_review";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type AdAccountPermission =
  | "account:view"
  | "account:manage"
  | "members:manage"
  | "campaigns:view"
  | "reports:view"
  | "campaigns:manage"
  | "audiences:manage"
  | "tools:manage"
  | "billing:view"
  | "billing:manage";

export const AD_ACCOUNT_ROLE_PERMISSIONS: Readonly<Record<AdAccountRole, ReadonlySet<AdAccountPermission>>> = {
  admin: new Set<AdAccountPermission>([
    "account:view", "account:manage", "members:manage", "campaigns:view", "reports:view", "campaigns:manage", "audiences:manage", "tools:manage", "billing:view", "billing:manage",
  ]),
  advertiser: new Set<AdAccountPermission>(["account:view", "campaigns:view", "reports:view", "campaigns:manage", "audiences:manage", "tools:manage", "billing:view"]),
  analyst: new Set<AdAccountPermission>(["account:view", "campaigns:view", "reports:view"]),
  billing: new Set<AdAccountPermission>(["account:view", "campaigns:view", "reports:view", "billing:view", "billing:manage"]),
};

export interface AdAccountRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: AdAccountKind;
  readonly ownerId: string;
  readonly storeId: string | null;
  readonly countryCode: string;
  readonly currency: CurrencyCode;
  readonly timezone: string;
  readonly status: AdAccountStatus;
  readonly disabledReason: string | null;
  readonly monthlySpendLimitMinor: number | null;
  readonly violationCount: number;
  readonly lastViolationAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewAdAccountInput = Pick<AdAccountRecord, "name" | "kind" | "ownerId" | "storeId" | "countryCode" | "currency" | "timezone">;
export type AdAccountChanges = Partial<Pick<AdAccountRecord, "name" | "timezone" | "status" | "disabledReason" | "monthlySpendLimitMinor" | "violationCount" | "lastViolationAt">>;

export interface AdAccountMemberRecord {
  readonly accountId: string;
  readonly userId: string;
  readonly role: AdAccountRole;
  readonly addedAt: Date;
  readonly lastActiveAt: Date | null;
}

export interface AdAccountInviteRecord {
  readonly id: string;
  readonly accountId: string;
  readonly emailHash: string;
  readonly emailCiphertext: string;
  readonly role: AdAccountRole;
  readonly invitedById: string;
  readonly tokenHash: string;
  readonly status: InviteStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export type AdActivityObjectType = "account" | "member" | "invite" | "campaign" | "ad_set" | "ad" | "billing" | "boost";

export interface AdActivityRecord {
  readonly id: string;
  readonly accountId: string;
  readonly actorId: string | null;
  readonly actorLabel: string;
  readonly objectType: AdActivityObjectType;
  readonly objectId: string;
  readonly summary: string;
  readonly changes: readonly { readonly field: string; readonly from: unknown; readonly to: unknown }[];
  readonly createdAt: Date;
}

export type NewAdActivityInput = Omit<AdActivityRecord, "id">;
