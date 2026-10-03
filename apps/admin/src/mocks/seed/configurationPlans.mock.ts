import type { PlanPrice, PlansConfiguration, VerificationPlan } from "@/types/platformConfiguration.type";

const supportedCurrencies = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;
const yearlyDiscountPercent = 20;

const monthlyMajorPricesByPlan: Record<string, Record<(typeof supportedCurrencies)[number], number>> = {
  BLUE_ESSENTIAL: { NGN: 1_000, GHS: 15, KES: 150, ZAR: 20, GBP: 1, EUR: 1.2, USD: 1.2 },
  BLUE_VERIFIED: { NGN: 2_500, GHS: 45, KES: 450, ZAR: 60, GBP: 3, EUR: 3.5, USD: 3.5 },
  BLUE_PREMIUM: { NGN: 4_500, GHS: 120, KES: 1_200, ZAR: 160, GBP: 8, EUR: 9, USD: 9 },
  GOLD_PRO: { NGN: 5_000, GHS: 250, KES: 2_500, ZAR: 330, GBP: 16, EUR: 19, USD: 19 },
  GOLD_PREMIUM: { NGN: 15_000, GHS: 600, KES: 6_000, ZAR: 800, GBP: 39, EUR: 45, USD: 45 },
};

function buildPricesForPlan(planKey: string): PlanPrice[] {
  const majorPrices = monthlyMajorPricesByPlan[planKey];
  if (!majorPrices) return [];
  return supportedCurrencies.map((currency) => {
    const monthlyMinor = Math.round(majorPrices[currency] * 100);
    return { currency, monthly: { amountMinor: monthlyMinor, currency }, yearly: { amountMinor: Math.round((monthlyMinor * 12 * (100 - yearlyDiscountPercent)) / 100), currency } };
  });
}

const goldEntitlements = (isPremium: boolean) => [
  { key: "pos", label: "Point of sale on Zudomart Dashboard", limit: null },
  { key: "staffSeats", label: "Staff seats", limit: isPremium ? 15 : 3 },
  { key: "storeLocations", label: "Store locations", limit: isPremium ? 10 : 1 },
  { key: "advancedReports", label: "Advanced sales reports and exports", limit: null },
  { key: "catalogImport", label: "Bulk catalog import (CSV)", limit: isPremium ? 20_000 : 2_000 },
];

export function buildInitialPlansConfiguration(): PlansConfiguration {
  const plan = (planKey: string, fields: Omit<VerificationPlan, "planKey" | "prices" | "dashboardEntitlements"> & { dashboardEntitlements?: VerificationPlan["dashboardEntitlements"] }): VerificationPlan => ({
    planKey,
    dashboardEntitlements: [],
    prices: fields.isPurchasable ? buildPricesForPlan(planKey) : [],
    ...fields,
  });
  return {
    supportedCurrencies: [...supportedCurrencies],
    plans: [
      plan("BLUE_ESSENTIAL", { color: "BLUE", tier: "ESSENTIAL", displayName: "Blue Essential", badgeVisible: false, isPurchasable: true, perks: ["Priority account recovery", "Impersonation protection", "Edit posts within 1 hour"] }),
      plan("BLUE_VERIFIED", { color: "BLUE", tier: "VERIFIED", displayName: "Blue Verified", badgeVisible: true, isPurchasable: true, perks: ["Blue badge on profile and posts", "Priority ranking in comments", "Longer clips (up to 10 minutes)", "Custom app icons"] }),
      plan("BLUE_PREMIUM", { color: "BLUE", tier: "PREMIUM", displayName: "Blue Premium", badgeVisible: true, isPurchasable: true, perks: ["Everything in Blue Verified", "Fewer ads in feed", "Monthly boost credit", "Priority support"] }),
      plan("GOLD_PRO", { color: "GOLD", tier: "PRO", displayName: "Gold Pro", badgeVisible: true, isPurchasable: true, perks: ["Gold business badge", "Zudomart Dashboard access", "Verified store label on products"], dashboardEntitlements: goldEntitlements(false) }),
      plan("GOLD_PREMIUM", { color: "GOLD", tier: "PREMIUM", displayName: "Gold Premium", badgeVisible: true, isPurchasable: true, perks: ["Everything in Gold Pro", "Dedicated account manager", "Lower payout hold period"], dashboardEntitlements: goldEntitlements(true) }),
      plan("BLACK_OFFICIAL", { color: "BLACK", tier: "OFFICIAL", displayName: "Black Official", badgeVisible: true, isPurchasable: false, perks: ["Government and public institution badge", "Granted only through the manual official process"] }),
    ],
  };
}
