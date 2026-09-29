import type { PlatformRole } from "../../../constants/platformRoles.constant.js";

export type StaffAccountStatus = "active" | "disabled";

export interface StaffAccountRecord {
  readonly userId: string;
  readonly role: PlatformRole;
  readonly permissions: readonly string[];
  readonly status: StaffAccountStatus;
  readonly ipAllowList: readonly string[];
  readonly totpSecretEncrypted: string | null;
  readonly pendingTotpSecretEncrypted: string | null;
  readonly totpEnabledAt: Date | null;
  readonly totpLastUsedStep: number | null;
  readonly recoveryCodeHashes: readonly string[];
  readonly createdById: string | null;
  readonly disabledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewStaffAccountInput {
  readonly userId: string;
  readonly role: PlatformRole;
  readonly permissions: readonly string[];
  readonly ipAllowList: readonly string[];
  readonly createdById: string | null;
}

export type StaffAccountChanges = Partial<
  Pick<
    StaffAccountRecord,
    | "role"
    | "permissions"
    | "status"
    | "ipAllowList"
    | "totpSecretEncrypted"
    | "pendingTotpSecretEncrypted"
    | "totpEnabledAt"
    | "totpLastUsedStep"
    | "recoveryCodeHashes"
    | "disabledAt"
  >
>;

export interface StaffLoginChallengeRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export interface StaffSessionRecord {
  readonly sessionId: string;
  readonly userId: string;
  readonly mfaVerifiedAt: Date;
  readonly stepUpVerifiedAt: Date | null;
  readonly createdAt: Date;
}

export interface WebAuthnCredentialRecord {
  readonly id: string;
  readonly userId: string;
  readonly credentialId: string;
  readonly publicKey: string;
  readonly signCount: number;
  readonly transports: readonly string[];
  readonly nickname: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
}

export type NewWebAuthnCredentialInput = Omit<WebAuthnCredentialRecord, "id" | "createdAt" | "lastUsedAt">;

export function snapshotStaffAccountForAudit(account: StaffAccountRecord): Record<string, unknown> {
  return {
    role: account.role,
    permissions: [...account.permissions],
    status: account.status,
    ipAllowList: [...account.ipAllowList],
    totpEnabled: account.totpEnabledAt !== null,
    recoveryCodesRemaining: account.recoveryCodeHashes.length,
  };
}
