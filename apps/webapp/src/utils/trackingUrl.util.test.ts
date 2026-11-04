import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSafeTrackingUrl, isValidOptionalTrackingUrl, isValidTrackingNumber } from "./trackingUrl.util";

describe("optional tracking URL validation", () => {
  it("allows an omitted tracking link", () => {
    assert.equal(isValidOptionalTrackingUrl("  "), true);
  });

  it("accepts a normal HTTPS carrier link", () => {
    assert.equal(isValidOptionalTrackingUrl("https://carrier.example/track/ABC-1234"), true);
  });

  it("rejects insecure, malformed, credential-bearing, or overlong links", () => {
    assert.equal(isValidOptionalTrackingUrl("http://carrier.example/track"), false);
    assert.equal(isValidOptionalTrackingUrl("https://"), false);
    assert.equal(isValidOptionalTrackingUrl("https://user:pass@carrier.example/track"), false);
    assert.equal(isValidOptionalTrackingUrl("https://carrier.example/track with space"), false);
    assert.equal(isValidOptionalTrackingUrl(`https://carrier.example/${"x".repeat(300)}`), false);
  });
});

describe("tracking contract helpers", () => {
  it("matches the backend tracking-number contract", () => {
    assert.equal(isValidTrackingNumber(" GIG-1234 "), true);
    assert.equal(isValidTrackingNumber("1234"), true);
    assert.equal(isValidTrackingNumber("AB 1234"), false);
    assert.equal(isValidTrackingNumber("ABC"), false);
    assert.equal(isValidTrackingNumber("A".repeat(41)), false);
  });

  it("only exposes safe HTTPS tracking links from stored data", () => {
    assert.equal(getSafeTrackingUrl("https://carrier.example/track"), "https://carrier.example/track");
    assert.equal(getSafeTrackingUrl("javascript:alert(1)"), null);
    assert.equal(getSafeTrackingUrl("https://user@carrier.example/track"), null);
    assert.equal(getSafeTrackingUrl(null), null);
  });
});
