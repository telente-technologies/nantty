import { ApiError } from "@/errors/api.error";
import type { GoldForBusinessesQuote } from "@/types/goldForBusinesses.type";

import { formatMoneyForDisplay } from "../formatMoney.util";
import {
  describeGoldCoverage, describeGoldForBusinessesFailure, goldQuoteBreakdownRows, goldQuotePerBusinessRows, goldTierRows, percentFromBasisPoints, toggleGoldProfileSelection,
} from "../goldForBusinessesQuote.util";

const naira = (amountMinor: number) => formatMoneyForDisplay({ amountMinor, currency: "NGN" });

const yearlyQuoteForThree: GoldForBusinessesQuote = {
  interval: "year", currency: "NGN", region: "NG",
  unitMonthlyPrice: { amountMinor: 300000, currency: "NGN" },
  listTotal: { amountMinor: 10800000, currency: "NGN" },
  total: { amountMinor: 9028800, currency: "NGN" },
  breakdown: {
    unitMonthlyMinor: 300000, profileCount: 3, months: 12, interval: "year", grossMinor: 10800000, tierBps: 1200, tierDiscountMinor: 1296000,
    yearlyExtraBps: 500, yearlyExtraDiscountMinor: 475200, standardYearlyBps: 0, standardYearlyDiscountMinor: 0, totalMinor: 9028800, perProfileMinor: [3009600, 3009600, 3009600],
  },
  discount: { listAmountMinor: 10800000, amountMinor: 9028800, discountKind: "multi_business", discountBps: 1640 },
  profiles: [
    { profileId: "p1", displayName: "Temi Homes", profileType: "business", price: { amountMinor: 3009600, currency: "NGN" } },
    { profileId: "p2", displayName: "Temi Clay", profileType: "brand", price: { amountMinor: 3009600, currency: "NGN" } },
    { profileId: "p3", displayName: "Lagos Food Bank", profileType: "business", price: { amountMinor: 3009600, currency: "NGN" } },
  ],
  lineItems: [],
  canBuyOnWeb: true,
};

describe("Gold for all your businesses price breakdown", () => {
  it("shows the per-business price, tier discount, yearly extra 5% and total straight from the server quote", () => {
    const rows = goldQuoteBreakdownRows(yearlyQuoteForThree);
    expect(rows.map((row) => row.key)).toEqual(["perProfile", "list", "tier", "yearlyExtra", "total"]);
    expect(rows[0]).toMatchObject({ label: "Gold per business", value: `${naira(300000)}/month` });
    expect(rows[1]).toMatchObject({ label: "3 businesses × 12 months", value: naira(10800000) });
    expect(rows[2]).toMatchObject({ label: "Multi-business discount (12%)", value: `−${naira(1296000)}` });
    expect(rows[3]).toMatchObject({ label: "Extra yearly discount (5%)", value: `−${naira(475200)}` });
    expect(rows[4]).toMatchObject({ label: "Total per year", value: naira(9028800), emphasis: true });
  });

  it("drops the yearly rows for monthly billing and shows the normal yearly discount after a lapse", () => {
    const monthly = { ...yearlyQuoteForThree, interval: "month" as const, breakdown: { ...yearlyQuoteForThree.breakdown, months: 1, yearlyExtraBps: 0, yearlyExtraDiscountMinor: 0 } };
    expect(goldQuoteBreakdownRows(monthly).map((row) => row.key)).toEqual(["perProfile", "list", "tier", "total"]);
    const monthlyRows = goldQuoteBreakdownRows(monthly);
    expect(monthlyRows[monthlyRows.length - 1]?.label).toBe("Total per month");
    const lapsed = { ...yearlyQuoteForThree, breakdown: { ...yearlyQuoteForThree.breakdown, tierBps: 0, tierDiscountMinor: 0, yearlyExtraDiscountMinor: 0, standardYearlyBps: 2000, standardYearlyDiscountMinor: 2160000 } };
    expect(goldQuoteBreakdownRows(lapsed).find((row) => row.key === "standardYearly")?.label).toBe("Yearly discount (20%)");
  });

  it("lists each business with its share of the total", () => {
    expect(goldQuotePerBusinessRows(yearlyQuoteForThree)[1]).toMatchObject({ label: "Temi Clay", value: `${naira(3009600)}/year` });
  });

  it("turns basis points into percentages and builds the tier table", () => {
    expect(percentFromBasisPoints(1600)).toBe("16%");
    expect(percentFromBasisPoints(1640)).toBe("16.4%");
    expect(goldTierRows({ maximumProfiles: 5, yearlyExtraBps: 500, yearlyMode: "replace", tiers: [{ profiles: 1, discountBps: 500 }, { profiles: 5, discountBps: 1600 }] })).toEqual([
      { key: "1", label: "1 business", value: "5% off" },
      { key: "5", label: "5 businesses", value: "16% off" },
    ]);
  });
});

describe("choosing businesses", () => {
  it("toggles a business and never goes past the maximum", () => {
    expect(toggleGoldProfileSelection(["a"], "b", 5)).toEqual(["a", "b"]);
    expect(toggleGoldProfileSelection(["a", "b"], "a", 5)).toEqual(["b"]);
    expect(toggleGoldProfileSelection(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  it("describes coverage and server refusals in plain words", () => {
    expect(describeGoldCoverage("removing")).toBe("Leaves the plan at renewal");
    expect(describeGoldCoverage("none")).toBeNull();
    expect(describeGoldForBusinessesFailure(new ApiError(403, "raw", "PREMIUM_REQUIRED"))).toMatch(/needs Blue Premium/);
    expect(describeGoldForBusinessesFailure(new ApiError(409, "raw", "PRICE_CHANGED"))).toMatch(/price changed/);
    expect(describeGoldForBusinessesFailure(null)).toBeNull();
  });
});
