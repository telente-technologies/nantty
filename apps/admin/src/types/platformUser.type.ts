export type PlatformUserStatus = "ACTIVE" | "WARNED" | "SUSPENDED" | "BANNED" | "DEACTIVATED" | "DELETED";
export type VerificationColor = "BLUE" | "GOLD" | "BLACK";
export type VerificationTier = "ESSENTIAL" | "VERIFIED" | "PREMIUM" | "ONLY" | "PRO" | "BUSINESS" | "OFFICIAL";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "SUSPENDED" | "REVOKED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface UserVerificationSummary {
  readonly color: VerificationColor;
  readonly tier: VerificationTier;
  readonly status: VerificationStatus;
  readonly badgeVisible: boolean;
}

export interface PlatformUserSummary {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly country: string;
  readonly currency: string;
  readonly status: PlatformUserStatus;
  readonly verification: UserVerificationSummary | null;
  readonly isSeller: boolean;
  readonly isCreator: boolean;
  readonly followerCount: number;
  readonly joinedAt: string;
  readonly lastActiveAt: string;
  readonly strikeCount: number;
  readonly riskLevel: RiskLevel;
  readonly emailMasked: string;
  readonly phoneMasked: string;
}

export interface PlatformUserPersonalData {
  readonly email: string;
  readonly phone: string;
  readonly legalName: string;
  readonly dateOfBirth: string | null;
}
