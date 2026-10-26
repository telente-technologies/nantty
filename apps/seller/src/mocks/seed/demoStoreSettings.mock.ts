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
  readonly returnPolicy: string;
  readonly shippingPolicy: string;
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
    policies: {
      returns: basics.returnPolicy,
      shipping: basics.shippingPolicy,
      privacy: "We only use your details to deliver your order and reply to your messages in the Nantty app.",
    },
    storeRewards: { enabled: true, percentBackBasisPoints: 500, minimumOrder: { amountMinor: 500_000, currency }, maxPerOrder: { amountMinor: 200_000, currency }, expiryDays: 180 },
    notifications: { newOrderEmail: true, newOrderSms: false, lowStockEmail: true, payoutEmail: true, disputeEmail: true, dailySummaryEmail: true, lowStockSms: false, reviewEmail: true, messageDigestEmail: true, weeklyPerformanceEmail: true },
  };
}
