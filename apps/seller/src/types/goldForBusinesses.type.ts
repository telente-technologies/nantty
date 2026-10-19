import type { Money } from "@/types/money.type";

export type GoldForBusinessesCoverage = "none" | "pending" | "active" | "removing";
export type GoldForBusinessesDiscountKind = "multi_business" | "offer" | "yearly" | "none";

export interface GoldForBusinessesProfile {
  readonly profileId: string;
  readonly displayName: string;
  readonly profileType: "business" | "brand";
  readonly coverage: GoldForBusinessesCoverage;
  readonly hasOwnGold: boolean;
}

export interface GoldForBusinessesTier {
  readonly profiles: number;
  readonly discountBps: number;
}

export interface GoldForBusinessesSubscription {
  readonly id: string;
  readonly status: string;
  readonly interval: "month" | "year";
  readonly price: Money;
  readonly discountKind: GoldForBusinessesDiscountKind;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly coveredProfiles: readonly GoldForBusinessesProfile[];
}

export interface GoldForBusinessesOverview {
  readonly premium: boolean;
  readonly rules: { readonly maximumProfiles: number; readonly yearlyExtraBps: number; readonly yearlyMode: "replace" | "add"; readonly tiers: readonly GoldForBusinessesTier[] };
  readonly businesses: readonly GoldForBusinessesProfile[];
  readonly subscription: GoldForBusinessesSubscription | null;
}
