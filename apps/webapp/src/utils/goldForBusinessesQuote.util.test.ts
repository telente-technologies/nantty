import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GoldForBusinessesQuote } from "@/types/goldForBusinesses.type";

import { buildGoldQuoteBreakdownRows, describeGoldTier, formatBasisPointsAsPercent } from "./goldForBusinessesQuote.util";

const yearlyQuote: GoldForBusinessesQuote = {
  interval: "year", currency: "NGN", region: "NG",
  unitMonthlyPrice: { amountMinor: 300_000, currency: "NGN" },
  listTotal: { amountMinor: 10_800_000, currency: "NGN" },
  total: { amountMinor: 9_028_800, currency: "NGN" },
  breakdown: { unitMonthlyMinor: 300_000, profileCount: 3, months: 12, interval: "year", grossMinor: 10_800_000, tierBps: 1200, tierDiscountMinor: 1_296_000, yearlyExtraBps: 500, yearlyExtraDiscountMinor: 475_200, standardYearlyBps: 0, standardYearlyDiscountMinor: 0, totalMinor: 9_028_800, perProfileMinor: [3_009_600, 3_009_600, 3_009_600] },
  discount: { listAmountMinor: 10_800_000, amountMinor: 9_028_800, discountKind: "multi_business", discountBps: 1640 },
  profiles: [], lineItems: [], canBuyOnWeb: true,
};

describe("gold for businesses quote breakdown", () => {
  it("shows the per-business price, tier discount, extra yearly 5% and total from the server quote", () => {
    const rows = buildGoldQuoteBreakdownRows(yearlyQuote);
    assert.deepEqual(rows.map((row) => row.key), ["perProfile", "gross", "tier", "yearlyExtra", "total"]);
    assert.match(rows[0]?.value ?? "", /3,000\.00 \/ month$/);
    assert.equal(rows[1]?.label, "3 businesses × 12 months");
    assert.equal(rows[2]?.label, "Multi-business discount (12%)");
    assert.match(rows[2]?.value ?? "", /^-.*12,960\.00$/);
    assert.equal(rows[3]?.label, "Extra yearly discount (5%)");
    assert.match(rows[3]?.value ?? "", /^-.*4,752\.00$/);
    assert.match(rows[4]?.value ?? "", /90,288\.00 \/ year$/);
    assert.equal(rows[4]?.emphasis, true);
  });

  it("drops empty discounts and shows the normal yearly discount after a Premium lapse", () => {
    const lapsed: GoldForBusinessesQuote = { ...yearlyQuote, breakdown: { ...yearlyQuote.breakdown, tierBps: 0, tierDiscountMinor: 0, yearlyExtraBps: 0, yearlyExtraDiscountMinor: 0, standardYearlyBps: 2000, standardYearlyDiscountMinor: 2_160_000 } };
    const rows = buildGoldQuoteBreakdownRows(lapsed);
    assert.deepEqual(rows.map((row) => row.key), ["perProfile", "gross", "standardYearly", "total"]);
    assert.equal(rows[2]?.label, "Yearly discount (20%)");
  });

  it("formats tiers and basis points", () => {
    assert.equal(formatBasisPointsAsPercent(1600), "16%");
    assert.equal(formatBasisPointsAsPercent(1250), "12.5%");
    assert.equal(describeGoldTier({ profiles: 1, discountBps: 500 }), "1 business: 5% off");
    assert.equal(describeGoldTier({ profiles: 5, discountBps: 1600 }), "5 businesses: 16% off");
  });
});
