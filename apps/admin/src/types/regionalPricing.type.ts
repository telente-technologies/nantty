export type PricingRegionCode = "NG" | "GH" | "KE" | "ZA" | "GB" | "EU" | "US";

export interface PricingRegion {
  readonly region: PricingRegionCode;
  readonly currency: string;
}

export type StoreProductKey = "ios.month" | "ios.year" | "android.month" | "android.year";

export interface PlanPriceRow {
  readonly planCode: string;
  readonly countryCode: PricingRegionCode;
  readonly currency: string;
  readonly monthlyAmountMinor: number;
  readonly yearlyAmountMinor: number;
  readonly iosMonthlyAmountMinor: number;
  readonly iosYearlyAmountMinor: number;
  readonly androidMonthlyAmountMinor: number;
  readonly androidYearlyAmountMinor: number;
  readonly storeProductIds: Partial<Record<StoreProductKey, string>>;
  readonly active: boolean;
  readonly updatedByStaffId?: string;
}

export interface PlanPriceTable {
  readonly data: readonly PlanPriceRow[];
  readonly regions: readonly PricingRegion[];
}

export interface CoinPackPriceRow {
  readonly id: string;
  readonly name: string;
  readonly clientPlatform: "web" | "ios" | "android";
  readonly coins: number;
  readonly bonusCoins: number;
  readonly prices: Readonly<Record<string, number>>;
  readonly storeProductId: string;
  readonly active: boolean;
  readonly sortOrder: number;
}

export interface AdRegionPricing {
  readonly region: PricingRegionCode;
  readonly currency: string;
  readonly cpmFloorMinor: number;
  readonly cpcFloorMinor: number;
  readonly minimumDailyBudgetMinor: number;
  readonly boostMinimumDailyMinor: number;
  readonly suggestedCpmMinor: number;
  readonly suggestedCpcMinor: number;
  readonly suggestedCpvMinor: number;
  readonly suggestedDailyBudgetMinor: number;
}

export interface CreatorSubscriptionBand {
  readonly band: string;
  readonly webMinor: number;
  readonly appMinor: number;
}

export interface RegionalPricingDocument {
  readonly ads: readonly AdRegionPricing[];
  readonly creatorSubscriptionBands: Readonly<Partial<Record<PricingRegionCode, readonly CreatorSubscriptionBand[]>>>;
}
