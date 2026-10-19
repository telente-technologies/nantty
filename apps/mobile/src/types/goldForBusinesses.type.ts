import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type GoldForBusinessesInterval = "month" | "year";

export type GoldCoverage = "none" | "pending" | "active" | "removing";

export type GoldDiscountKind = "multi_business" | "offer" | "yearly" | "none";

export interface GoldForBusinessesTier {
  readonly profiles: number;
  readonly discountBps: number;
}

export interface GoldForBusinessesRules {
  readonly maximumProfiles: number;
  readonly yearlyExtraBps: number;
  readonly yearlyMode: string;
  readonly tiers: readonly GoldForBusinessesTier[];
}

export interface GoldEligibleBusiness {
  readonly profileId: ID;
  readonly displayName: string;
  readonly profileType: "business" | "brand";
  readonly coverage: GoldCoverage;
  readonly hasOwnGold: boolean;
}

export interface GoldForBusinessesSubscription {
  readonly id: ID;
  readonly status: string;
  readonly interval: GoldForBusinessesInterval;
  readonly price: Money;
  readonly discountKind: GoldDiscountKind;
  readonly currentPeriodEnd: ISODate | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly coveredProfiles: readonly GoldEligibleBusiness[];
}

export interface GoldForBusinessesOverview {
  readonly premium: boolean;
  readonly rules: GoldForBusinessesRules;
  readonly businesses: readonly GoldEligibleBusiness[];
  readonly subscription: GoldForBusinessesSubscription | null;
}

export interface GoldQuoteLineItem {
  readonly kind: string;
  readonly label: string;
  readonly amountMinor: number;
}

export interface GoldQuoteBreakdown {
  readonly unitMonthlyMinor: number;
  readonly profileCount: number;
  readonly months: number;
  readonly interval: GoldForBusinessesInterval;
  readonly grossMinor: number;
  readonly tierBps: number;
  readonly tierDiscountMinor: number;
  readonly yearlyExtraBps: number;
  readonly yearlyExtraDiscountMinor: number;
  readonly standardYearlyBps: number;
  readonly standardYearlyDiscountMinor: number;
  readonly totalMinor: number;
  readonly perProfileMinor: readonly number[];
}

export interface GoldForBusinessesQuote {
  readonly interval: GoldForBusinessesInterval;
  readonly currency: Money["currency"];
  readonly region: string;
  readonly unitMonthlyPrice: Money;
  readonly listTotal: Money;
  readonly total: Money;
  readonly breakdown: GoldQuoteBreakdown;
  readonly discount: { readonly listAmountMinor: number; readonly amountMinor: number; readonly discountKind: GoldDiscountKind; readonly discountBps: number; readonly offerDiscountMinor?: number };
  readonly profiles: readonly { readonly profileId: ID; readonly displayName: string; readonly profileType: "business" | "brand"; readonly price: Money }[];
  readonly lineItems: readonly GoldQuoteLineItem[];
  readonly canBuyOnWeb: boolean;
  readonly billingNote?: string;
}

export interface GoldForBusinessesQuoteInput {
  readonly profileIds: readonly ID[];
  readonly interval: GoldForBusinessesInterval;
}

export interface GoldCoverageChangeInput {
  readonly profileIds: readonly ID[];
  readonly expectedChargeMinor?: number;
}

export interface GoldCoverageChange {
  readonly added: readonly ID[];
  readonly removing: readonly ID[];
  readonly removalsEffectiveAt: ISODate;
  readonly charge: {
    readonly lineItems: readonly GoldQuoteLineItem[];
    readonly subtotalMinor: number;
    readonly amountDueMinor: number;
    readonly creditAppliedMinor: number;
    readonly remainingCreditMinor: number;
    readonly checkmarkIncluded: boolean;
  };
  readonly chargeStatus?: "succeeded" | "pending" | "requires_action" | "failed";
  readonly actionUrl?: string;
}
