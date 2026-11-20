import type { Money } from "@/types/api.type";
import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserPersonalData, PlatformUserSummary } from "@/types/platformUser.type";

export interface UserSession {
  readonly id: string;
  readonly device: string;
  readonly platform: "IOS" | "ANDROID" | "WEB";
  readonly ipAddress: string;
  readonly location: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
}

export interface UserStrike {
  readonly id: string;
  readonly policy: string;
  readonly reason: string;
  readonly source: "MODERATION" | "COPYRIGHT" | "MANUAL";
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly issuedByName: string;
}

export interface UserWalletBalance {
  readonly currency: string;
  readonly available: Money;
  readonly pending: Money;
  readonly inEscrow: Money;
}

export interface UserWalletSummary {
  readonly balances: readonly UserWalletBalance[];
  readonly coinBalance: number;
  readonly pendingWithdrawalCount: number;
}

export type UsernameChangeKind = "USER_CHANGE" | "WITHHELD" | "RESTORED" | "ASSIGNED_TO_CLAIMANT" | "RECEIVED_FROM_RECLAIM" | "REASSIGNED_AWAY" | "REASSIGNED_TO";

export interface UsernameHistoryEntry {
  readonly id: string;
  readonly fromUsername: string;
  readonly toUsername: string;
  readonly kind: UsernameChangeKind;
  readonly changedAt: string;
  readonly changedByName: string;
  readonly reason: string | null;
}

export interface UserRestriction {
  readonly kind: "SUSPENSION" | "BAN" | "FEATURE_RESTRICTION";
  readonly features?: readonly string[];
  readonly reason: string;
  readonly startedAt: string;
  readonly endsAt: string | null;
}

export interface WithheldUsername {
  readonly username: string;
  readonly originalOwnerId: string;
  readonly originalOwnerDisplayName: string;
  readonly withheldAt: string;
  readonly withheldByName: string;
  readonly reason: string;
}

export interface UserDetail {
  readonly user: PlatformUserSummary;
  readonly bio: string | null;
  readonly restriction: UserRestriction | null;
  readonly wallet: UserWalletSummary;
  readonly strikes: readonly UserStrike[];
  readonly sessions: readonly UserSession[];
  readonly usernameHistory: readonly UsernameHistoryEntry[];
  readonly withheldUsername: WithheldUsername | null;
  readonly history: readonly AuditLogEntry[];
}

export interface UserListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly verification?: string;
  readonly role?: string;
  readonly risk?: string;
  readonly cursor?: string;
}

export interface UserPersonalDataResponse extends PlatformUserPersonalData {
  readonly revealedAt: string;
  readonly expiresInSeconds: number;
}

export interface UsernameNotificationPreview {
  readonly channel: "IN_APP_AND_EMAIL";
  readonly title: string;
  readonly body: string;
}

export interface UsernameWithholdResult {
  readonly user: PlatformUserSummary;
  readonly withheldUsername: WithheldUsername;
  readonly assignedUsername: string;
  readonly notification: UsernameNotificationPreview;
}

export interface HeldUsername {
  readonly username: string;
  readonly releasedAt: string;
  readonly availableAt: string;
  readonly isHeld: boolean;
}

export interface CreatorViolation {
  readonly id: string;
  readonly userId: string;
  readonly reason: string;
  readonly source: string;
  readonly recordedBy: string;
  readonly createdAt: string;
}
