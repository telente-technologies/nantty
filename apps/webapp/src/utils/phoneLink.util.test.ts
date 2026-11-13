import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSafePhoneLink } from "./phoneLink.util";

describe("buildSafePhoneLink", () => {
  it("normalizes common international phone formatting", () => {
    assert.equal(buildSafePhoneLink(" +234 (803) 123-4567 "), "tel:+2348031234567");
  });

  it("rejects non-phone text and unsupported URL-like values", () => {
    assert.equal(buildSafePhoneLink("call +2348031234567"), null);
    assert.equal(buildSafePhoneLink("javascript:alert(1)"), null);
  });

  it("rejects too-short values and misplaced plus signs", () => {
    assert.equal(buildSafePhoneLink("+234 80"), null);
    assert.equal(buildSafePhoneLink("234+8031234567"), null);
  });
});
