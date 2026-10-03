import type { PlatformUserSummary, VerificationColor } from "@/types/platformUser.type";

export type ProfileType = "PERSONAL" | "BUSINESS" | "BRAND" | "GOVERNMENT";

export interface AdminCreatedAccount {
  readonly profileType: ProfileType;
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly reason: string;
  readonly mustChangePassword: boolean;
  readonly bypassedReservedEntries: readonly string[];
}

export interface CreateAccountInput {
  readonly username: string;
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly country: string;
  readonly profileType: ProfileType;
  readonly reason: string;
}

export interface CheckmarkGrant {
  readonly id: string;
  readonly user: PlatformUserSummary;
  readonly color: VerificationColor;
  readonly reason: string;
  readonly grantedByName: string;
  readonly grantedAt: string;
  readonly revokedAt: string | null;
  readonly revokedByName: string | null;
  readonly revokedReason: string | null;
}

export interface GrantCheckmarkInput {
  readonly username: string;
  readonly color: VerificationColor;
  readonly reason: string;
}
