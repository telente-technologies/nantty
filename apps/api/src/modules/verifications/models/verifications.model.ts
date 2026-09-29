import type {
  ProfileType,
  VerificationColor,
  VerificationStatus,
  VerificationTier,
  VerificationType,
} from "../../../interfaces/verificationBadge.interface.js";

export type ProfileKind = "user" | "store";

export const PROFILE_TYPES = ["PERSONAL", "BUSINESS", "STORE", "GOVERNMENT"] as const;
export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "SUSPENDED", "REVOKED"] as const;
export const VERIFICATION_TYPES = ["PERSONAL", "BUSINESS", "GOVERNMENT"] as const;
export const VERIFICATION_TIERS = ["ESSENTIAL", "VERIFIED", "PREMIUM", "PRO", "OFFICIAL"] as const;
export const IDENTITY_DOCUMENT_TYPES = ["nin", "bvn", "passport", "drivers_license", "voters_card", "national_id"] as const;

export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export interface VerificationDetails {
  readonly legalName: string | null;
  readonly businessName: string | null;
  readonly businessAddress: string | null;
  readonly registrationNumberEncrypted: string | null;
  readonly registrationNumberLast4: string | null;
  readonly contactPhoneEncrypted: string | null;
  readonly contactPhoneLast4: string | null;
  readonly idType: IdentityDocumentType | null;
  readonly idNumberEncrypted: string | null;
  readonly idNumberLast4: string | null;
  readonly documentMediaIds: readonly string[];
}

export interface VerificationRecord {
  readonly id: string;
  readonly profileId: string;
  readonly profileKind: ProfileKind;
  readonly ownerUserId: string;
  readonly profileType: ProfileType;
  readonly verificationType: VerificationType;
  readonly color: VerificationColor;
  readonly status: VerificationStatus;
  readonly tier: VerificationTier | null;
  readonly badgeVisible: boolean;
  readonly applicationSubmittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedById: string | null;
  readonly reason: string | null;
  readonly details: VerificationDetails | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewVerification = Omit<VerificationRecord, "id" | "createdAt" | "updatedAt">;

export type VerificationPatch = Partial<
  Pick<VerificationRecord, "status" | "tier" | "badgeVisible" | "applicationSubmittedAt" | "reviewedAt" | "reviewedById" | "reason" | "details">
>;

export interface VerificationFilter {
  readonly status?: VerificationStatus | undefined;
  readonly type?: VerificationType | undefined;
}

export interface ResolvedProfile {
  readonly profileId: string;
  readonly profileKind: ProfileKind;
  readonly profileType: ProfileType;
  readonly ownerUserId: string;
}
