import type { CurrencyCode, Money } from "@/types/money.type";

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "zudomart_wallet" | "pay_link";
export type ReceiptPaperWidth = "58mm" | "80mm";

export interface TaxRate {
  readonly id: string;
  readonly name: string;
  readonly rateBasisPoints: number;
  readonly isDefault: boolean;
  readonly appliesToCategoryIds: string[] | null;
}

export interface ReceiptTemplate {
  readonly showLogo: boolean;
  readonly headerText: string;
  readonly footerText: string;
  readonly returnPolicy: string;
  readonly paperWidth: ReceiptPaperWidth;
  readonly showCashierName: boolean;
}

export interface PaymentMethodSetting {
  readonly method: PaymentMethod;
  readonly enabled: boolean;
  readonly label: string;
  readonly instructions: string | null;
}

export interface LoyaltyRules {
  readonly enabled: boolean;
  readonly spendRequiredPerPoint: Money;
  readonly redeemValuePerPoint: Money;
  readonly minimumPointsToRedeem: number;
}

export interface NotificationPreferences {
  readonly newOrderEmail: boolean;
  readonly newOrderSms: boolean;
  readonly lowStockEmail: boolean;
  readonly payoutEmail: boolean;
  readonly disputeEmail: boolean;
  readonly dailySummaryEmail: boolean;
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
  readonly receipt: ReceiptTemplate;
  readonly paymentMethods: PaymentMethodSetting[];
  readonly discountApprovalThresholdBasisPoints: number;
  readonly loyalty: LoyaltyRules;
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

export interface PosRegister {
  readonly id: string;
  readonly locationId: string;
  readonly name: string;
  readonly openShiftId: string | null;
  readonly active: boolean;
}
