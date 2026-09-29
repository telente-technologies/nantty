import type { MoneyDto } from "../../../utils/money.util.js";
import type { CreatorApplicationStatus, CreatorEarningKind, CreatorEarningSource, CreatorEligibility } from "../models/creators.model.js";

export interface CreatorApplicationDto {
  readonly id: string;
  readonly userId: string;
  readonly status: CreatorApplicationStatus;
  readonly eligibility: CreatorEligibility;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

export interface GiftCatalogEntryDto {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly price: MoneyDto;
  readonly prices: readonly MoneyDto[];
}

export interface LiveGiftReceiptDto {
  readonly id: string;
  readonly liveSessionId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly amount: MoneyDto;
  readonly createdAt: string;
}

export interface CreatorEarningDto {
  readonly id: string;
  readonly kind: CreatorEarningKind;
  readonly source: { readonly type: CreatorEarningSource; readonly id: string };
  readonly amount: MoneyDto;
  readonly grossAmount: MoneyDto;
  readonly orderId: string | null;
  readonly productId: string | null;
  readonly createdAt: string;
}

export interface CreatorDashboardDto {
  readonly period: string;
  readonly since: string | null;
  readonly followers: { readonly total: number; readonly gainedInPeriod: number | null };
  readonly content: { readonly posts: number; readonly views: number };
  readonly earnings: { readonly gifts: readonly MoneyDto[]; readonly affiliate: readonly MoneyDto[] };
  readonly live: { readonly sessionsHosted: number; readonly reactions: number; readonly giftsReceived: number };
  readonly walletBalances: readonly MoneyDto[];
}

export interface AffiliateCommissionDto {
  readonly id: string;
  readonly storeId: string;
  readonly productId: string | null;
  readonly commissionBps: number;
  readonly commissionPercent: number;
  readonly updatedAt: string;
}

export interface CreatorAffiliationDto {
  readonly storeId: string;
  readonly productId: string | null;
  readonly storeName: string | null;
  readonly productTitle: string | null;
  readonly commissionBps: number | null;
  readonly commissionPercent: number | null;
  readonly createdAt: string;
}
