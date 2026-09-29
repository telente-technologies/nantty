import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { IntelligenceAdPlacement, IntelligenceBidType } from "../../intelligence/models/intelligenceAds.model.js";
import type { SponsoredSurface } from "../../../interfaces/discovery.interface.js";

export const MILLI_MINOR_UNITS_PER_MINOR_UNIT = 1_000;

export type AdEventType = "impression" | "click" | "conversion";

export interface AdServingRecord {
  readonly id: string;
  readonly auctionId: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly adId: string;
  readonly viewerId: string;
  readonly surface: SponsoredSurface;
  readonly placement: IntelligenceAdPlacement;
  readonly itemId: string;
  readonly hostContentId: string | null;
  readonly hostCreatorId: string | null;
  readonly chargeModel: IntelligenceBidType;
  readonly chargePriceMinor: number;
  readonly currency: CurrencyCode;
  readonly servedAt: Date;
}

export type NewAdServingInput = Omit<AdServingRecord, "id">;

export interface AdEventRecord {
  readonly id: string;
  readonly dedupeKey: string;
  readonly type: AdEventType;
  readonly servingId: string | null;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly adId: string;
  readonly viewerId: string;
  readonly surface: string;
  readonly billed: boolean;
  readonly chargeMilliMinor: number;
  readonly currency: CurrencyCode;
  readonly rejectionReason: string | null;
  readonly orderId: string | null;
  readonly valueMinor: number | null;
  readonly occurredAt: Date;
}

export type NewAdEventInput = Omit<AdEventRecord, "id">;

export interface AdEventFilter {
  readonly accountId: string;
  readonly campaignIds?: readonly string[];
  readonly adSetId?: string;
  readonly adId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export type BillingTransactionType = "top_up" | "ad_spend" | "credit_grant" | "credit_spend" | "refund" | "card_charge";

export interface AdBillingTransactionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly type: BillingTransactionType;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly reference: string;
  readonly createdAt: Date;
}

export type NewAdBillingTransactionInput = Omit<AdBillingTransactionRecord, "id">;

export interface SpendReservation {
  readonly scopeId: string;
  readonly period: string;
  readonly amountMilliMinor: number;
  readonly limitMilliMinor: number | null;
}

export interface SpendCounterKey {
  readonly scopeId: string;
  readonly period: string;
}
