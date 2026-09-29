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
  readonly imageUrl: string | null;
  readonly priceCoins: number;
}

export interface GiftReceiptDto {
  readonly id: string;
  readonly liveSessionId: string | null;
  readonly postId: string | null;
  readonly giftId: string;
  readonly quantity: number;
  readonly coins: number;
  readonly coinBalance: number;
  readonly createdAt: string;
}

export interface EarningAmountDto {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface CreatorEarningDto {
  readonly id: string;
  readonly kind: CreatorEarningKind;
  readonly source: { readonly type: CreatorEarningSource; readonly id: string };
  readonly amount: EarningAmountDto;
  readonly grossAmount: EarningAmountDto;
  readonly orderId: string | null;
  readonly productId: string | null;
  readonly createdAt: string;
}

export interface CreatorDashboardDto {
  readonly period: string;
  readonly since: string | null;
  readonly followers: { readonly total: number; readonly gainedInPeriod: number | null };
  readonly content: { readonly posts: number; readonly views: number };
  readonly earnings: { readonly gifts: readonly EarningAmountDto[]; readonly tips: readonly EarningAmountDto[]; readonly affiliate: readonly EarningAmountDto[]; readonly subscriptions: readonly EarningAmountDto[] };
  readonly coins: { readonly spendable: number; readonly earned: number };
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

export interface TipReceiptDto {
  readonly tipId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly coins: number;
  readonly balance: number;
}

export interface CoinConversionReceiptDto {
  readonly coins: number;
  readonly cash: MoneyDto;
  readonly earnedCoinsRemaining: number;
  readonly minimumPayout: MoneyDto;
}

export interface CreatorRevenueRulesDto {
  readonly giftCreatorSharePercentUpTo: number;
  readonly tipCreatorSharePercent: number;
  readonly subscriptionCreatorSharePercent: number;
  readonly adsRevenueCreatorSharePercent: number;
  readonly coinTransferPlatformFeePercent: number;
  readonly affiliateCommissionReleasedAfterEscrow: boolean;
  readonly coinCashValue: MoneyDto;
  readonly minimumPayout: MoneyDto;
  readonly withdrawalFeeDescription: string;
}

export interface BrandDealDto {
  readonly id: string;
  readonly brandName: string;
  readonly amount: MoneyDto;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly disclosure: string;
  readonly notes: string | null;
  readonly createdAt: string;
}
