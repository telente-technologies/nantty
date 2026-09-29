import type { ProductCategory } from "@/types/catalog.type";
import type { PosRegister, StoreLocation, StoreSettings } from "@/types/store.type";

export const demoMainStoreId = "store_ife_lifestyle";

export function buildIfeLifestyleStoreSettings(): StoreSettings {
  return {
    storeId: demoMainStoreId,
    name: "Ìfẹ́ Lifestyle",
    handle: "ife.lifestyle",
    logoUrl: null,
    description: "Everyday fashion, beauty and gadgets from Lagos and Abuja — in store and on Zudomart.",
    country: "NG",
    currency: "NGN",
    timezone: "Africa/Lagos",
    locale: "en-NG",
    phone: "+234 803 555 0142",
    email: "hello@ifelifestyle.ng",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    taxes: [{ id: "tax_vat", name: "VAT", rateBasisPoints: 750, isDefault: true, appliesToCategoryIds: null }],
    pricesIncludeTax: true,
    receipt: {
      showLogo: true,
      headerText: "Thank you for shopping with us!",
      footerText: "Follow us on Zudomart @ife.lifestyle",
      returnPolicy: "Returns and exchanges within 7 days with this receipt. Food items and earrings cannot be returned.",
      paperWidth: "80mm",
      showCashierName: true,
    },
    paymentMethods: [
      { method: "cash", enabled: true, label: "Cash", instructions: null },
      { method: "card", enabled: true, label: "Card (POS terminal)", instructions: "Use the Moniepoint terminal and enter the approval code." },
      { method: "bank_transfer", enabled: true, label: "Bank transfer", instructions: "Providus Bank · 9920184411 · Ife Lifestyle Ltd" },
      { method: "zudomart_wallet", enabled: true, label: "Zudomart wallet", instructions: null },
      { method: "pay_link", enabled: true, label: "Pay link", instructions: null },
    ],
    discountApprovalThresholdBasisPoints: 1500,
    loyalty: { enabled: true, spendRequiredPerPoint: { amountMinor: 100_000, currency: "NGN" }, redeemValuePerPoint: { amountMinor: 1_000, currency: "NGN" }, minimumPointsToRedeem: 100 },
    notifications: { newOrderEmail: true, newOrderSms: true, lowStockEmail: true, payoutEmail: true, disputeEmail: true, dailySummaryEmail: false },
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

export function buildIfeLifestyleRegisters(): PosRegister[] {
  return [
    { id: "reg_lekki_1", locationId: "loc_lekki", name: "Front counter", openShiftId: null, active: true },
    { id: "reg_lekki_2", locationId: "loc_lekki", name: "Tablet by the door", openShiftId: null, active: true },
    { id: "reg_ikeja_1", locationId: "loc_ikeja", name: "Kiosk till", openShiftId: null, active: true },
    { id: "reg_wuse_1", locationId: "loc_wuse", name: "Main till", openShiftId: null, active: true },
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
