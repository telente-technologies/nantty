import type { PlansConfiguration, VerificationPlan } from "@/types/platformConfiguration.type";

const supportedCurrencies = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;
const goldEntitlements = (isPremium: boolean) => [
  { key: "pos", label: "Point of sale on Zudomart Dashboard", limit: null },
  { key: "staffSeats", label: "Staff seats", limit: isPremium ? 15 : 3 },
  { key: "storeLocations", label: "Store locations", limit: isPremium ? 10 : 1 },
  { key: "advancedReports", label: "Advanced sales reports and exports", limit: null },
  { key: "catalogImport", label: "Bulk catalog import (CSV)", limit: isPremium ? 20_000 : 2_000 },
];

export function buildInitialPlansConfiguration(): PlansConfiguration {
  const plan = (planKey: string, fields: Omit<VerificationPlan, "planKey" | "dashboardEntitlements"> & { dashboardEntitlements?: VerificationPlan["dashboardEntitlements"] }): VerificationPlan => ({
    planKey,
    dashboardEntitlements: [],
    ...fields,
  });
  return {
    supportedCurrencies: [...supportedCurrencies],
    plans: [
      plan("BLUE_ESSENTIAL", { color: "BLUE", tier: "ESSENTIAL", displayName: "Blue Essential", badgeVisible: false, isPurchasable: true, perks: ["Priority account recovery", "Impersonation protection", "Edit posts within 1 hour"] }),
      plan("BLUE_VERIFIED", { color: "BLUE", tier: "VERIFIED", displayName: "Blue Verified", badgeVisible: true, isPurchasable: true, perks: ["Blue badge on profile and posts", "Priority ranking in comments", "Longer clips (up to 10 minutes)", "Custom app icons"] }),
      plan("BLUE_PREMIUM", { color: "BLUE", tier: "PREMIUM", displayName: "Blue Premium", badgeVisible: true, isPurchasable: true, perks: ["Everything in Blue Verified", "Fewer ads in feed", "Monthly boost credit", "Priority support"] }),
      plan("GOLD_ONLY", { color: "GOLD", tier: "ONLY", displayName: "Gold", badgeVisible: true, isPurchasable: true, perks: ["Gold business badge", "Verified store label on products"] }),
      plan("GOLD_PRO", { color: "GOLD", tier: "PRO", displayName: "Gold Pro", badgeVisible: true, isPurchasable: true, perks: ["Gold business badge", "Zudomart Dashboard access", "Verified store label on products"], dashboardEntitlements: goldEntitlements(false) }),
      plan("GOLD_BUSINESS", { color: "GOLD", tier: "BUSINESS", displayName: "Gold Business", badgeVisible: true, isPurchasable: true, perks: ["Everything in Gold Pro", "Dedicated account manager", "Lower escrow fee"], dashboardEntitlements: goldEntitlements(true) }),
      plan("BLACK_OFFICIAL", { color: "BLACK", tier: "OFFICIAL", displayName: "Black Official", badgeVisible: true, isPurchasable: false, perks: ["Government and public institution badge", "Granted only through the manual official process"] }),
    ],
  };
}
