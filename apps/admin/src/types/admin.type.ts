import type { AdminPermission } from "@/constants/adminPermissions.constant";

export type AdminRole = "SUPERADMIN" | "ADMIN" | "SUPPORT";
export type AdminStatus = "ACTIVE" | "INVITED" | "DISABLED" | "LOCKED";

export interface SignedInAdmin {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly permissions: readonly AdminPermission[];
}

export interface AdminSessionView {
  readonly admin: SignedInAdmin;
  readonly sessionStartedAtEpochSeconds: number;
  readonly lastActivityAtEpochSeconds: number;
  readonly idleTimeoutSeconds: number;
  readonly absoluteTimeoutSeconds: number;
  readonly environment: "production" | "staging" | "development";
  readonly isMockBackend: boolean;
}

export interface AdminAccountSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AdminRole;
  readonly status: AdminStatus;
  readonly permissions: readonly AdminPermission[];
  readonly mfaEnrolled: boolean;
  readonly passkeyCount: number;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly createdByName: string | null;
}

export interface AdminPasskey {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

export interface AdminActiveSession {
  readonly id: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly isCurrent: boolean;
}
