import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export type CreatorApplicationStatus = "pending" | "approved" | "rejected";
export type CreatorProfileStatus = "approved" | "suspended";
export type CreatorProgramStatus = "none" | CreatorApplicationStatus | "suspended";
export type CreatorEarningKind = "gift" | "affiliate";
export type CreatorEarningSource = "live" | "post" | "clip";

export interface EligibilityCriterion {
  readonly met: boolean;
  readonly current: number | boolean | string | null;
  readonly required: number | boolean | readonly string[];
}

export interface CreatorEligibility {
  readonly eligible: boolean;
  readonly criteria: Readonly<Record<string, EligibilityCriterion>>;
}

export interface CreatorApplicationRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: CreatorApplicationStatus;
  readonly eligibility: CreatorEligibility;
  readonly reviewerId: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
}

export interface CreatorProfileRecord {
  readonly userId: string;
  readonly status: CreatorProfileStatus;
  readonly tier: string;
  readonly approvedAt: Date;
  readonly suspendedAt: Date | null;
  readonly suspensionReason: string | null;
}

export interface CreatorViolationRecord {
  readonly id: string;
  readonly userId: string;
  readonly reason: string;
  readonly recordedById: string | null;
  readonly createdAt: Date;
}

export interface CreatorEarningRecord {
  readonly id: string;
  readonly creatorId: string;
  readonly kind: CreatorEarningKind;
  readonly reference: string;
  readonly sourceType: CreatorEarningSource;
  readonly sourceId: string;
  readonly grossAmount: MinorUnits;
  readonly netAmount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly orderId: string | null;
  readonly productId: string | null;
  readonly createdAt: Date;
}

export type NewCreatorEarning = Omit<CreatorEarningRecord, "id">;

export interface LiveGiftRecord {
  readonly id: string;
  readonly liveSessionId: string;
  readonly senderId: string;
  readonly creatorId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly reference: string;
  readonly createdAt: Date;
}

export type NewLiveGift = Omit<LiveGiftRecord, "id">;

export interface AffiliateCommissionRecord {
  readonly id: string;
  readonly storeId: string;
  readonly productId: string | null;
  readonly commissionBps: number;
  readonly updatedById: string;
  readonly updatedAt: Date;
}

export interface CreatorAffiliationRecord {
  readonly creatorId: string;
  readonly storeId: string;
  readonly productId: string | null;
  readonly createdAt: Date;
}

export function buildAffiliateTargetKey(storeId: string, productId: string | null): string {
  return productId === null ? `store:${storeId}` : `product:${productId}`;
}
