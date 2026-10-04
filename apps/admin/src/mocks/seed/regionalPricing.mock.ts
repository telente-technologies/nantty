import type { AdRegionPricing, CoinPackPriceRow, CreatorSubscriptionBand, PlanPriceRow, PricingRegion, PricingRegionCode, RegionalPricingDocument, StoreProductKey } from "@/types/regionalPricing.type";

export const pricingRegions: readonly PricingRegion[] = [
  { region: "NG", currency: "NGN" },
  { region: "GH", currency: "GHS" },
  { region: "KE", currency: "KES" },
  { region: "ZA", currency: "ZAR" },
  { region: "GB", currency: "GBP" },
  { region: "EU", currency: "EUR" },
  { region: "US", currency: "USD" },
];

type WebAndApp = readonly [web: number, app: number];

const monthlyPlanPrices: Record<string, Record<PricingRegionCode, WebAndApp>> = {
  blue_essential: { NG: [100_000, 120_000], GH: [1_200, 1_500], KE: [20_000, 25_000], ZA: [2_999, 3_499], GB: [249, 299], EU: [249, 299], US: [249, 299] },
  blue: { NG: [250_000, 290_000], GH: [3_000, 3_500], KE: [50_000, 60_000], ZA: [5_999, 6_999], GB: [599, 699], EU: [599, 699], US: [599, 699] },
  premium: { NG: [450_000, 550_000], GH: [5_500, 6_500], KE: [90_000, 110_000], ZA: [10_999, 12_999], GB: [999, 1_199], EU: [1_099, 1_299], US: [999, 1_199] },
  seller_pro: { NG: [500_000, 0], GH: [6_000, 0], KE: [100_000, 0], ZA: [14_999, 0], GB: [1_500, 0], EU: [1_700, 0], US: [1_700, 0] },
  seller_business: { NG: [1_500_000, 0], GH: [18_000, 0], KE: [300_000, 0], ZA: [44_999, 0], GB: [4_500, 0], EU: [4_900, 0], US: [4_900, 0] },
  gold_only: { NG: [300_000, 0], GH: [3_600, 0], KE: [60_000, 0], ZA: [8_999, 0], GB: [900, 0], EU: [1_000, 0], US: [1_000, 0] },
  black: { NG: [5_000_000, 0], GH: [60_000, 0], KE: [1_000_000, 0], ZA: [149_999, 0], GB: [14_900, 0], EU: [16_900, 0], US: [16_900, 0] },
};

function roundUpToStep(amountMinor: number, stepMinor: number): number {
  return Math.ceil(amountMinor / stepMinor) * stepMinor;
}

export function roundToPricePoint(amountMinor: number, currency: string): number {
  if (amountMinor <= 0) return 0;
  if (currency === "NGN") return roundUpToStep(amountMinor, amountMinor >= 1_000_000 ? 50_000 : 10_000);
  if (currency === "KES") return roundUpToStep(amountMinor, amountMinor >= 100_000 ? 5_000 : 1_000);
  if (currency === "GHS") return roundUpToStep(amountMinor, 100);
  return roundUpToStep(amountMinor + 1, 100) - 1;
}

const yearlyFromMonthly = (monthlyMinor: number, currency: string) => roundToPricePoint(Math.round(monthlyMinor * 12 * 0.8), currency);

function storeProductIdsFor(planCode: string, isInApp: boolean): Partial<Record<StoreProductKey, string>> {
  if (!isInApp) return {};
  return { "ios.month": `com.zudomart.app.${planCode}.monthly`, "ios.year": `com.zudomart.app.${planCode}.yearly`, "android.month": `com.zudomart.app.${planCode}.monthly`, "android.year": `com.zudomart.app.${planCode}.yearly` };
}

export function buildInitialPlanPriceRows(): PlanPriceRow[] {
  return Object.entries(monthlyPlanPrices).flatMap(([planCode, byRegion]) =>
    pricingRegions.map(({ region, currency }) => {
      const [web, app] = byRegion[region];
      return {
        planCode, countryCode: region, currency, monthlyAmountMinor: web, yearlyAmountMinor: yearlyFromMonthly(web, currency),
        iosMonthlyAmountMinor: app, iosYearlyAmountMinor: yearlyFromMonthly(app, currency), androidMonthlyAmountMinor: app, androidYearlyAmountMinor: yearlyFromMonthly(app, currency),
        storeProductIds: storeProductIdsFor(planCode, app > 0), active: true,
      };
    }),
  );
}

const hundredCoinPrices: Record<string, WebAndApp> = { NGN: [100_000, 120_000], GHS: [1_200, 1_500], KES: [13_000, 16_000], ZAR: [1_899, 2_299], GBP: [99, 119], EUR: [99, 119], USD: [99, 119] };
const coinTiers = [
  { tier: "1", coins: 100, webBonus: 0 },
  { tier: "2", coins: 500, webBonus: 0 },
  { tier: "3", coins: 1_000, webBonus: 30 },
  { tier: "4", coins: 2_500, webBonus: 100 },
  { tier: "5", coins: 5_000, webBonus: 250 },
  { tier: "6", coins: 10_000, webBonus: 600 },
];

export function buildInitialCoinPackRows(): CoinPackPriceRow[] {
  return (["web", "ios", "android"] as const).flatMap((clientPlatform) =>
    coinTiers.map(({ tier, coins, webBonus }, index) => ({
      id: `${clientPlatform}-coins-${tier}`, name: `${coins.toLocaleString("en-US")} coins`, clientPlatform, coins, bonusCoins: clientPlatform === "web" ? webBonus : 0,
      prices: Object.fromEntries(Object.entries(hundredCoinPrices).map(([currency, [web, app]]) => [currency, roundToPricePoint(((clientPlatform === "web" ? web : app) * coins) / 100, currency)])),
      storeProductId: clientPlatform === "web" ? "" : `com.zudomart.app.coins.tier${tier}`, active: true, sortOrder: index + 1,
    })),
  );
}

const adRegionPricing: readonly AdRegionPricing[] = [
  { region: "NG", currency: "NGN", cpmFloorMinor: 50_000, cpcFloorMinor: 3_000, minimumDailyBudgetMinor: 100_000, boostMinimumDailyMinor: 100_000 },
  { region: "GH", currency: "GHS", cpmFloorMinor: 600, cpcFloorMinor: 40, minimumDailyBudgetMinor: 1_500, boostMinimumDailyMinor: 1_500 },
  { region: "KE", currency: "KES", cpmFloorMinor: 6_000, cpcFloorMinor: 400, minimumDailyBudgetMinor: 15_000, boostMinimumDailyMinor: 15_000 },
  { region: "ZA", currency: "ZAR", cpmFloorMinor: 1_500, cpcFloorMinor: 120, minimumDailyBudgetMinor: 4_000, boostMinimumDailyMinor: 4_000 },
  { region: "GB", currency: "GBP", cpmFloorMinor: 200, cpcFloorMinor: 15, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
  { region: "EU", currency: "EUR", cpmFloorMinor: 200, cpcFloorMinor: 15, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
  { region: "US", currency: "USD", cpmFloorMinor: 250, cpcFloorMinor: 20, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
];

const bandNames = ["supporter", "fan", "superfan", "vip"];
const creatorBands: Record<PricingRegionCode, readonly WebAndApp[]> = {
  NG: [[50_000, 60_000], [100_000, 120_000], [200_000, 240_000], [500_000, 590_000]],
  GH: [[600, 700], [1_200, 1_500], [2_500, 3_000], [6_000, 7_000]],
  KE: [[10_000, 12_000], [20_000, 25_000], [40_000, 50_000], [100_000, 120_000]],
  ZA: [[1_499, 1_899], [2_999, 3_499], [5_999, 6_999], [14_999, 17_999]],
  GB: [[199, 249], [399, 499], [799, 999], [1_599, 1_999]],
  EU: [[199, 249], [449, 549], [899, 1_099], [1_799, 2_199]],
  US: [[199, 249], [499, 599], [999, 1_199], [1_999, 2_499]],
};

export function buildInitialRegionalPricingDocument(): RegionalPricingDocument {
  const bands = Object.fromEntries(
    Object.entries(creatorBands).map(([region, pairs]) => [region, pairs.map(([web, app], index): CreatorSubscriptionBand => ({ band: bandNames[index] ?? `band${index}`, webMinor: web, appMinor: app }))]),
  );
  return { ads: adRegionPricing, creatorSubscriptionBands: bands };
}
