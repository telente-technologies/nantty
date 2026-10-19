import type { ID, ISODate } from "./models.type";
import type { Money } from "./money.type";

export type GoldBillingInterval = "month" | "year";

export type GoldBusinessCoverage = "none" | "pending" | "active" | "removing";

export interface GoldForBusinessesBusiness {
  readonly profileId: ID;
  readonly displayName: string;
  readonly profileType: "business" | "brand";
  readonly coverage: GoldBusinessCoverage;
  readonly hasOwnGold: boolean;
}

export interface GoldForBusinessesTier {
  readonly profiles: number;
  readonly discountBps: number;
}

export interface GoldForBusinessesSubscription {
  readonly id: ID;
  readonly status: string;
  readonly interval: GoldBillingInterval;
  readonly price: Money;
  readonly discountKind: "multi_business" | "offer" | "yearly" | "none";
  readonly currentPeriodEnd: ISODate | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly coveredProfiles: readonly GoldForBusinessesBusiness[];
}

export interface GoldForBusinessesState {
  readonly premium: boolean;
  readonly rules: { readonly maximumProfiles: number; readonly yearlyExtraBps: number; readonly yearlyMode: string; readonly tiers: readonly GoldForBusinessesTier[] };
  readonly businesses: readonly GoldForBusinessesBusiness[];
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
  readonly interval: GoldBillingInterval;
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
  readonly interval: GoldBillingInterval;
  readonly currency: Money["currency"];
  readonly region: string;
  readonly unitMonthlyPrice: Money;
  readonly listTotal: Money;
  readonly total: Money;
  readonly breakdown: GoldQuoteBreakdown;
  readonly discount: { readonly listAmountMinor: number; readonly amountMinor: number; readonly discountKind: string; readonly discountBps: number; readonly offerDiscountMinor?: number };
  readonly profiles: readonly { readonly profileId: ID; readonly displayName: string; readonly profileType: string; readonly price: Money }[];
  readonly lineItems: readonly GoldQuoteLineItem[];
  readonly canBuyOnWeb: boolean;
  readonly billingNote?: string;
}

export interface GoldForBusinessesQuoteInput {
  readonly profileIds: readonly ID[];
  readonly interval: GoldBillingInterval;
}

export interface GoldForBusinessesCheckoutInput extends GoldForBusinessesQuoteInput {
  readonly returnTo: string;
  readonly expectedTotalMinor: number;
}

export interface GoldForBusinessesCheckout {
  readonly subscriptionId: ID;
  readonly authorizationUrl: string;
  readonly reference: string;
  readonly provider: string;
  readonly price: Money;
  readonly activated?: boolean;
}

export interface GoldForBusinessesProfilesChange {
  readonly added: readonly ID[];
  readonly removing: readonly ID[];
  readonly removalsEffectiveAt: ISODate;
  readonly charge: { readonly lineItems: readonly GoldQuoteLineItem[]; readonly subtotalMinor: number; readonly amountDueMinor: number; readonly creditAppliedMinor: number; readonly remainingCreditMinor: number; readonly checkmarkIncluded: boolean };
  readonly chargeStatus?: "succeeded" | "pending" | "requires_action" | "failed";
  readonly actionUrl?: string;
}
