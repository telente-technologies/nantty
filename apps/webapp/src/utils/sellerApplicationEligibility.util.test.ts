import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSellerApplicationCountryEligible, normalizeSellerCountryCode } from "./sellerApplicationEligibility.util";

describe("seller application country eligibility", () => {
  it("allows Nigeria independent of casing or surrounding whitespace", () => {
    assert.equal(isSellerApplicationCountryEligible("NG"), true);
    assert.equal(isSellerApplicationCountryEligible(" ng "), true);
  });

  it("blocks other countries and does not infer a country when the value is missing or malformed", () => {
    for (const countryCode of ["GH", "US", null, undefined, "", "NGA", "1G"]) {
      assert.equal(isSellerApplicationCountryEligible(countryCode), false);
    }
    assert.equal(normalizeSellerCountryCode(null), null);
    assert.equal(normalizeSellerCountryCode("NGA"), null);
  });
});
