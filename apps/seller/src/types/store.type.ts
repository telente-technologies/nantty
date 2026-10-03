import type { CurrencyCode, Money } from "@/types/money.type";


export interface TaxRate {
  readonly id: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly isDefault: boolean;
  readonly appliesToCategoryIds: string[] | null;
}

export interface StoreRewardsRules {
  readonly enabled: boolean;
  readonly percentBackBasisPoints: number;
  readonly minimumOrder: Money;
  readonly maxPerOrder: Money;
  readonly expiryDays: number;
}

export interface StoreRewardsSummary {
  readonly outstandingLiability: Money;
  readonly customersWithCredit: number;
  readonly issuedLast30Days: Money;
  readonly redeemedLast30Days: Money;
}

export interface NotificationPreferences {
  readonly newOrderEmail: boolean;
  readonly newOrderSms: boolean;
  readonly lowStockEmail: boolean;
  readonly payoutEmail: boolean;
  readonly disputeEmail: boolean;
  readonly dailySummaryEmail: boolean;
  readonly lowStockSms: boolean;
  readonly reviewEmail: boolean;
  readonly messageDigestEmail: boolean;
  readonly weeklyPerformanceEmail: boolean;
}

export interface StorePolicies {
  readonly returns: string;
  readonly shipping: string;
  readonly privacy: string;
}

export interface StoreSettings {
  readonly storeId: string;
  readonly name: string;
  readonly handle: string;
  readonly logoUrl: string | null;
  readonly description: string;
  readonly country: string;
  readonly currency: CurrencyCode;
  readonly timezone: string;
  readonly locale: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly taxes: TaxRate[];
  readonly pricesIncludeTax: boolean;
  readonly policies: StorePolicies;
  readonly storeRewards: StoreRewardsRules;
  readonly notifications: NotificationPreferences;
}

export interface StoreLocation {
  readonly id: string;
  readonly name: string;
  readonly kind: "store" | "warehouse";
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly phone: string | null;
  readonly isDefault: boolean;
  readonly active: boolean;
}
