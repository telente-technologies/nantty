import type { CurrencyCode } from "@/types/money.type";
import type { StoreSettings, TaxRate } from "@/types/store.type";

export interface DemoStoreSettingsBasics {
  readonly storeId: string;
  readonly name: string;
  readonly handle: string;
  readonly description: string;
  readonly country: string;
  readonly currency: CurrencyCode;
  readonly timezone: string;
  readonly locale: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly taxes: TaxRate[];
  readonly receiptHeaderText: string;
  readonly receiptFooterText: string;
  readonly returnPolicy: string;
  readonly paperWidth: StoreSettings["receipt"]["paperWidth"];
  readonly cardTerminalInstructions: string;
  readonly bankTransferInstructions: string;
  readonly loyalty: { readonly enabled: boolean; readonly spendRequiredPerPointMinor: number; readonly redeemValuePerPointMinor: number; readonly minimumPointsToRedeem: number };
}

export function buildDemoStoreSettingsFromBasics(basics: DemoStoreSettingsBasics): StoreSettings {
  const { currency } = basics;
  return {
    storeId: basics.storeId,
    name: basics.name,
    handle: basics.handle,
    logoUrl: null,
    description: basics.description,
    country: basics.country,
    currency,
    timezone: basics.timezone,
    locale: basics.locale,
    phone: basics.phone,
    email: basics.email,
    address: basics.address,
    taxes: basics.taxes,
    pricesIncludeTax: true,
    receipt: { showLogo: true, headerText: basics.receiptHeaderText, footerText: basics.receiptFooterText, returnPolicy: basics.returnPolicy, paperWidth: basics.paperWidth, showCashierName: true },
    paymentMethods: [
      { method: "cash", enabled: true, label: "Cash", instructions: null },
      { method: "card", enabled: true, label: "Card (POS terminal)", instructions: basics.cardTerminalInstructions },
      { method: "bank_transfer", enabled: true, label: "Bank transfer", instructions: basics.bankTransferInstructions },
      { method: "zudomart_wallet", enabled: true, label: "Zudomart wallet", instructions: null },
      { method: "pay_link", enabled: true, label: "Pay link", instructions: null },
    ],
    discountApprovalThresholdBasisPoints: 1000,
    loyalty: {
      enabled: basics.loyalty.enabled,
      spendRequiredPerPoint: { amountMinor: basics.loyalty.spendRequiredPerPointMinor, currency },
      redeemValuePerPoint: { amountMinor: basics.loyalty.redeemValuePerPointMinor, currency },
      minimumPointsToRedeem: basics.loyalty.minimumPointsToRedeem,
    },
    notifications: { newOrderEmail: true, newOrderSms: false, lowStockEmail: true, payoutEmail: true, disputeEmail: true, dailySummaryEmail: true },
  };
}
