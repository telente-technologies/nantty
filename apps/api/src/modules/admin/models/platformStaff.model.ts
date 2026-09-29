import type { PlatformRole } from "../../../constants/platformRoles.constant.js";

export type StaffAccountStatus = "ACTIVE" | "INVITED" | "DISABLED";
export type PresentedStaffStatus = StaffAccountStatus | "LOCKED";

export interface StaffAccountRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string | null;
  readonly role: PlatformRole;
  readonly permissions: readonly string[];
  readonly status: StaffAccountStatus;
  readonly ipAllowList: readonly string[];
  readonly totpSecretEncrypted: string | null;
  readonly pendingTotpSecretEncrypted: string | null;
  readonly totpEnabledAt: Date | null;
  readonly totpLastUsedStep: number | null;
  readonly recoveryCodeHashes: readonly string[];
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdById: string | null;
  readonly disabledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStaffAccountInput {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string | null;
  readonly role: PlatformRole;
  readonly permissions: readonly string[];
  readonly status: StaffAccountStatus;
  readonly ipAllowList: readonly string[];
  readonly createdById: string | null;
}

export type StaffAccountChanges = Partial<Omit<StaffAccountRecord, "id" | "email" | "createdAt" | "updatedAt" | "createdById">>;

export interface StaffAccountFilter {
  readonly search?: string | undefined;
  readonly status?: PresentedStaffStatus | undefined;
  readonly role?: PlatformRole | undefined;
}

export interface StaffInvitationRecord {
  readonly id: string;
  readonly staffId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
}

export interface StaffChallengeRecord {
  readonly id: string;
  readonly staffId: string;
  readonly tokenHash: string;
  readonly attempts: number;
  readonly webAuthnChallenge: string | null;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export interface StaffSessionRecord {
  readonly id: string;
  readonly staffId: string;
  readonly refreshTokenHash: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly stepUpTokenHash: string | null;
  readonly stepUpExpiresAt: Date | null;
  readonly webAuthnChallenge: string | null;
  readonly webAuthnChallengeExpiresAt: Date | null;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
}

export type NewStaffSessionInput = Pick<StaffSessionRecord, "id" | "staffId" | "refreshTokenHash" | "ipAddress" | "userAgent" | "createdAt" | "expiresAt">;

export type StaffSessionChanges = Partial<Pick<StaffSessionRecord, "stepUpTokenHash" | "stepUpExpiresAt" | "webAuthnChallenge" | "webAuthnChallengeExpiresAt" | "lastSeenAt">>;

export interface WebAuthnCredentialRecord {
  readonly id: string;
  readonly staffId: string;
  readonly credentialId: string;
  readonly publicKey: string;
  readonly signCount: number;
  readonly transports: readonly string[];
  readonly label: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
}

export type NewWebAuthnCredentialInput = Omit<WebAuthnCredentialRecord, "id" | "createdAt" | "lastUsedAt">;

export function presentStaffStatus(account: StaffAccountRecord, now: Date): PresentedStaffStatus {
  if (account.status === "ACTIVE" && account.lockedUntil !== null && account.lockedUntil > now) return "LOCKED";
  return account.status;
}

export function snapshotStaffAccountForAudit(account: StaffAccountRecord): Record<string, unknown> {
  return {
    role: account.role,
    permissions: [...account.permissions],
    status: account.status,
    ipAllowList: [...account.ipAllowList],
    mfaEnrolled: account.totpEnabledAt !== null,
    lockedUntil: account.lockedUntil?.toISOString() ?? null,
  };
}
