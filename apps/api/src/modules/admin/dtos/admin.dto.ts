import { ADMIN_PERMISSIONS } from "../../../constants/permissions.constant.js";
import { platformRoleGrantsPermission } from "../../../constants/platformRoles.constant.js";
import type { UserRecord } from "../../users/models/users.model.js";
import type { StaffAccountRecord, WebAuthnCredentialRecord } from "../models/platformStaff.model.js";

export interface StaffAccountDto {
  readonly userId: string;
  readonly username: string;
  readonly name: string;
  readonly email: string | null;
  readonly role: string;
  readonly permissions: readonly string[];
  readonly effectivePermissions: readonly string[];
  readonly status: string;
  readonly ipAllowList: readonly string[];
  readonly mfa: { readonly totpEnabled: boolean; readonly recoveryCodesRemaining: number };
  readonly createdById: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disabledAt: string | null;
}

export interface AdminMeDto extends StaffAccountDto {
  readonly sessionId: string;
  readonly stepUpValidUntil: string;
  readonly webAuthnCredentials: number;
}

export function convertStaffAccountToDto(account: StaffAccountRecord, user: UserRecord | undefined): StaffAccountDto {
  return {
    userId: account.userId,
    username: user?.username ?? "",
    name: user?.name ?? "",
    email: user?.email ?? null,
    role: account.role,
    permissions: [...account.permissions],
    effectivePermissions: ADMIN_PERMISSIONS.filter((permission) => platformRoleGrantsPermission(account.role, account.permissions, permission)),
    status: account.status,
    ipAllowList: [...account.ipAllowList],
    mfa: { totpEnabled: account.totpEnabledAt !== null, recoveryCodesRemaining: account.recoveryCodeHashes.length },
    createdById: account.createdById,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    disabledAt: account.disabledAt?.toISOString() ?? null,
  };
}

export function convertWebAuthnCredentialToDto(credential: WebAuthnCredentialRecord) {
  return {
    id: credential.id,
    nickname: credential.nickname,
    transports: [...credential.transports],
    createdAt: credential.createdAt.toISOString(),
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
  };
}
