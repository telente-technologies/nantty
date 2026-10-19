import type { Money } from "@/types/api.type";

export type AdCreditStatus = "active" | "expired" | "revoked" | "spent";

export type AdCreditSource = "admin_issued" | "cashback" | "premium_free_boost" | "boost_refund" | "legacy";

export interface AdCreditStaffReference {
  readonly id: string;
  readonly name: string;
}

export interface AdCreditGrant {
  readonly id: string;
  readonly userId: string;
  readonly username: string;
  readonly accountId: string;
  readonly source: AdCreditSource;
  readonly amount: Money;
  readonly remaining: Money;
  readonly expiresAt: string | null;
  readonly reason: string;
  readonly status: AdCreditStatus;
  readonly issuedBy: AdCreditStaffReference | null;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly revokedAmount: Money | null;
}

export interface AdCreditGrantFilters {
  readonly userId?: string;
  readonly status?: AdCreditStatus;
  readonly source?: AdCreditSource;
  readonly cursor?: string;
}

export interface AdCreditGrantPage {
  readonly items: readonly AdCreditGrant[];
  readonly nextCursor?: string | null;
}

export interface IssueAdCreditInput {
  readonly userId: string;
  readonly amount: Money;
  readonly expiresAt: string | null;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface AdCashbackSetting {
  readonly userId: string;
  readonly username: string;
  readonly enabled: boolean;
  readonly percent: number;
  readonly reason: string;
  readonly updatedAt: string;
  readonly updatedBy: AdCreditStaffReference | null;
}

export interface AdCashbackSettingPage {
  readonly items: readonly AdCashbackSetting[];
  readonly nextCursor?: string | null;
}

export interface SaveAdCashbackInput {
  readonly userId: string;
  readonly enabled: boolean;
  readonly percent: number;
  readonly reason: string;
  readonly idempotencyKey: string;
}
