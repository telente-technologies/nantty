import type { ProductCategory } from "@/types/catalog.type";
import type { StoreLocation, StoreSettings } from "@/types/store.type";

export const demoMainStoreId = "store_ife_lifestyle";

export function buildIfeLifestyleStoreSettings(): StoreSettings {
  return {
    storeId: demoMainStoreId,
    name: "Ìfẹ́ Lifestyle",
    handle: "ife.lifestyle",
    logoUrl: null,
    description: "Everyday fashion, beauty and gadgets from Lagos and Abuja, delivered across Nigeria through Nantty.",
    country: "NG",
    currency: "NGN",
    timezone: "Africa/Lagos",
    locale: "en-NG",
    phone: "+234 803 555 0142",
    email: "hello@ifelifestyle.ng",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    taxes: [{ id: "tax_vat", name: "VAT", rateBasisPoints: 750, isDefault: true, appliesToCategoryIds: null }],
    pricesIncludeTax: true,
    policies: {
      returns: "Returns and exchanges within 7 days of delivery for unworn items with tags. Food items and earrings cannot be returned.",
      shipping: "Lagos orders ship the same day if paid before 2pm. Abuja and other states take 2–4 working days.",
      privacy: "We only use your details to deliver your order and reply to your messages in the Nantty app.",
    },
    storeRewards: { enabled: true, percentBackBasisPoints: 500, minimumOrder: { amountMinor: 500_000, currency: "NGN" }, maxPerOrder: { amountMinor: 200_000, currency: "NGN" }, expiryDays: 180 },
    notifications: { newOrderEmail: true, newOrderSms: true, lowStockEmail: true, payoutEmail: true, disputeEmail: true, dailySummaryEmail: false, lowStockSms: false, reviewEmail: true, messageDigestEmail: true, weeklyPerformanceEmail: true },
  };
}

export function buildIfeLifestyleLocations(): StoreLocation[] {
  return [
    { id: "loc_lekki", name: "Lekki flagship", kind: "store", address: "12 Admiralty Way, Lekki Phase 1", city: "Lagos", state: "Lagos", country: "NG", phone: "+234 803 555 0142", isDefault: true, active: true },
    { id: "loc_ikeja", name: "Ikeja City Mall kiosk", kind: "store", address: "Obafemi Awolowo Way, Alausa", city: "Ikeja", state: "Lagos", country: "NG", phone: "+234 809 555 0177", isDefault: false, active: true },
    { id: "loc_wuse", name: "Wuse 2, Abuja", kind: "store", address: "18 Aminu Kano Crescent, Wuse 2", city: "Abuja", state: "FCT", country: "NG", phone: "+234 812 555 0190", isDefault: false, active: true },
    { id: "loc_apapa", name: "Apapa warehouse", kind: "warehouse", address: "Plot 4, Creek Road, Apapa", city: "Lagos", state: "Lagos", country: "NG", phone: null, isDefault: false, active: true },
  ];
}

export function buildIfeLifestyleCategories(): ProductCategory[] {
  return [
    { id: "cat_fashion", name: "Fashion" },
    { id: "cat_bags", name: "Bags" },
    { id: "cat_jewellery", name: "Jewellery" },
    { id: "cat_beauty", name: "Beauty & care" },
    { id: "cat_gadgets", name: "Gadgets" },
    { id: "cat_home", name: "Home" },
    { id: "cat_food", name: "Food & drinks" },
  ];
}
