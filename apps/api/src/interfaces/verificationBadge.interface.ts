export type ProfileType = "PERSONAL" | "BUSINESS" | "STORE" | "GOVERNMENT";
export type VerificationColor = "BLUE" | "GOLD" | "BLACK";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "SUSPENDED" | "REVOKED";
export type VerificationType = "PERSONAL" | "BUSINESS" | "GOVERNMENT";
export type VerificationTier = "ESSENTIAL" | "VERIFIED" | "PREMIUM" | "PRO" | "OFFICIAL";

export interface VerificationBadge {
  readonly status: VerificationStatus;
  readonly type: VerificationType;
  readonly color: VerificationColor;
  readonly tier: VerificationTier | null;
  readonly badgeVisible: boolean;
}

export interface VerificationBadgeLookup {
  findVerificationBadges(profileIds: readonly string[]): Promise<ReadonlyMap<string, VerificationBadge>>;
}

export const UNVERIFIED_PERSONAL_BADGE: VerificationBadge = { status: "UNVERIFIED", type: "PERSONAL", color: "BLUE", tier: null, badgeVisible: false };
export const UNVERIFIED_STORE_BADGE: VerificationBadge = { status: "UNVERIFIED", type: "BUSINESS", color: "GOLD", tier: null, badgeVisible: false };
