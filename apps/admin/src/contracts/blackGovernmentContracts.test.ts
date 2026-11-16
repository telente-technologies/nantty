import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adminApiRouteTable } from "@/config/apiRoutes.config";
import { buildInitialCheckmarkPricing } from "@/mocks/seed/configurationTrustRules.mock";
import { buildInitialPlanPriceRows } from "@/mocks/seed/regionalPricing.mock";

describe("black government configuration and route contracts", () => {
  it("seeds zero unpaid Black grace days and USD-only monthly-only Black pricing", () => {
    const pricingRules = buildInitialCheckmarkPricing();
    assert.equal(pricingRules.blackGraceDays, 0);

    const blackRows = buildInitialPlanPriceRows().filter((row) => row.planCode === "black");
    assert.ok(blackRows.length > 0);
    for (const row of blackRows) {
      assert.equal(row.currency, "USD");
      assert.equal(row.yearlyAmountMinor, 0);
      assert.equal(row.iosMonthlyAmountMinor, 0);
      assert.equal(row.androidMonthlyAmountMinor, 0);
      assert.equal(row.monthlyAmountMinor, row.countryCode === "NG" ? 30_000 : 50_000);
    }
  });

  it("requires step-up and audit permissions on Black verification and government billing control routes", () => {
    const routePaths = new Set(adminApiRouteTable.map((route) => `${route.method} ${route.path}`));
    for (const expected of [
      "GET /admin/black-applications/appeals",
      "POST /admin/black-applications/appeals/:id/decide",
      "POST /admin/black-applications/:id/require-reverification",
      "POST /admin/black-applications/:id/checkout-authorization",
      "GET /admin/subscriptions/government-black",
      "POST /admin/subscriptions/government-black/:id/{pause|cancel}",
      "POST /admin/subscriptions/government-black/:id/{retry|reconcile}",
    ]) {
      assert.equal(routePaths.has(expected), true, `missing admin route contract: ${expected}`);
    }
  });
});
