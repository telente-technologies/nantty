import assert from "node:assert/strict";
import test from "node:test";

import { buildInitialPlansConfiguration } from "@/mocks/seed/configurationPlans.mock";
import { readDemoVerificationPlanPrice } from "@/mocks/seed/peopleVerifications.mock";

test("demo verification prices match regional plan defaults in NGN", () => {
  const prices = [
    ["BLUE", "ESSENTIAL", 100_000], ["BLUE", "VERIFIED", 250_000], ["BLUE", "PREMIUM", 2_000_000],
    ["GOLD", "ONLY", 300_000], ["GOLD", "PRO", 500_000], ["GOLD", "BUSINESS", 3_000_000],
  ] as const;
  for (const [color, tier, amountMinor] of prices) {
    assert.equal(readDemoVerificationPlanPrice(color, tier, "NGN")?.price.amountMinor, amountMinor);
  }
});

test("demo Gold limits match the approved seller entitlement policy", () => {
  const plans = buildInitialPlansConfiguration().plans;
  const value = (planKey: string, entitlementKey: string) => plans.find((plan) => plan.planKey === planKey)?.dashboardEntitlements.find((entry) => entry.key === entitlementKey)?.limit;
  assert.equal(value("GOLD_PRO", "staffSeats"), 5);
  assert.equal(value("GOLD_PRO", "storeLocations"), 3);
  assert.equal(value("GOLD_BUSINESS", "staffSeats"), 25);
  assert.equal(value("GOLD_BUSINESS", "storeLocations"), 10);
});
