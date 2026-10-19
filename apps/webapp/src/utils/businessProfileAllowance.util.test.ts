import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BusinessProfileAllowance } from "@/types/brand.type";

import { describeBusinessProfileAllowance, describeBusinessProfileAllowanceNotice, describeProfileLimitError, readBusinessProfileAllowanceState, shouldShowStoreBadge, STORE_BADGE_TEXT } from "./businessProfileAllowance.util";
import { describeLimitError } from "./limitErrors.util";

const allowance = (overrides: Partial<BusinessProfileAllowance>): BusinessProfileAllowance => ({ count: 1, limit: 2, premiumLimit: 5, premium: false, premiumNeeded: false, storeUsed: false, ...overrides });

describe("business profile allowance", () => {
  it("counts profiles against the Premium or standard limit", () => {
    assert.equal(describeBusinessProfileAllowance(allowance({ count: 3, limit: 5, premium: true })), "3 of 5 business profiles (Premium)");
    assert.equal(describeBusinessProfileAllowance(allowance({ count: 1, limit: 2 })), "1 of 2 business profiles");
  });

  it("upsells Premium only to non-Premium users at their limit", () => {
    assert.equal(readBusinessProfileAllowanceState(allowance({ count: 1 })), "available");
    assert.equal(readBusinessProfileAllowanceState(allowance({ count: 2 })), "upgradeForMore");
    assert.match(describeBusinessProfileAllowanceNotice(allowance({ count: 2 })) ?? "", /Get Blue Premium for up to 5 business profiles/);
    assert.equal(readBusinessProfileAllowanceState(allowance({ count: 5, limit: 5, premium: true })), "premiumLimitReached");
    assert.doesNotMatch(describeBusinessProfileAllowanceNotice(allowance({ count: 5, limit: 5, premium: true })) ?? "", /Get Blue Premium/);
    assert.equal(describeBusinessProfileAllowanceNotice(allowance({ count: 4, limit: 5, premium: true })), null);
  });

  it("explains a Premium lapse without deleting anything", () => {
    const lapsed = allowance({ count: 4, limit: 2, premiumNeeded: true });
    assert.equal(readBusinessProfileAllowanceState(lapsed), "premiumNeeded");
    assert.match(describeBusinessProfileAllowanceNotice(lapsed) ?? "", /^Premium needed for more than 2 business profiles\./);
    assert.match(describeBusinessProfileAllowanceNotice(lapsed) ?? "", /nothing is deleted/);
  });

  it("shows the Store badge only on the profile that owns the store", () => {
    assert.equal(STORE_BADGE_TEXT, "Store");
    assert.equal(shouldShowStoreBadge({ ownsStore: true }), true);
    assert.equal(shouldShowStoreBadge({ ownsStore: false }), false);
    assert.equal(shouldShowStoreBadge({}), false);
  });

  it("gives friendly copy for the new profile limit conflicts", () => {
    assert.match(describeProfileLimitError("STORE_LIMIT_ONE") ?? "", /one store/);
    assert.match(describeProfileLimitError("BUSINESS_PROFILE_LIMIT") ?? "", /5 business profiles/);
    assert.equal(describeLimitError("STORE_LIMIT_ONE", null), describeProfileLimitError("STORE_LIMIT_ONE"));
    assert.equal(describeProfileLimitError("PROFILE_LIMIT_ONE_BRAND"), null);
  });
});
