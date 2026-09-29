import type { ReservedUsernameMatchKind } from "../../../constants/reservedUsernames.constant.js";

export type UsernameUnavailableReason = "taken" | "reserved" | "invalid" | "recently_used" | "withheld";
export type UsernameChangeReason = "user_change" | "admin_reclaim";
export type UsernameHoldKind = "quarantine" | "withheld";
export const USERNAME_WITHHOLD_REASONS = ["policy_violation", "impersonation", "legal_trademark"] as const;
export type UsernameWithholdReason = (typeof USERNAME_WITHHOLD_REASONS)[number];

export interface UsernameAvailability {
  readonly available: boolean;
  readonly reason?: UsernameUnavailableReason;
}

export interface UsernameChangeRecord {
  readonly id: string;
  readonly userId: string;
  readonly previousUsername: string;
  readonly newUsername: string;
  readonly reason: UsernameChangeReason;
  readonly changedById: string | null;
  readonly createdAt: Date;
}

export type NewUsernameChangeInput = Omit<UsernameChangeRecord, "id">;

export interface UsernameHoldRecord {
  readonly username: string;
  readonly kind: UsernameHoldKind;
  readonly heldForUserId: string | null;
  readonly reason: string;
  readonly note: string;
  readonly createdById: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface ReservedUsernameRecord {
  readonly id: string;
  readonly term: string;
  readonly matchKind: ReservedUsernameMatchKind;
  readonly reason: string;
  readonly createdById: string | null;
  readonly createdAt: Date;
}

export type NewReservedUsernameInput = Omit<ReservedUsernameRecord, "id" | "createdAt">;

export interface UsernamePolicySummary {
  readonly username: string;
  readonly canChangeNow: boolean;
  readonly nextChangeAvailableAt: string | null;
  readonly changesRemainingThisYear: number;
  readonly cooldownDays: number;
  readonly maxChangesPerYear: number;
  readonly quarantineDays: number;
  readonly rules: readonly string[];
  readonly history: readonly { readonly from: string; readonly to: string; readonly changedAt: string; readonly reason: UsernameChangeReason }[];
}

export function holdIsActiveAt(hold: UsernameHoldRecord, now: Date): boolean {
  return hold.expiresAt === null || hold.expiresAt > now;
}
