import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSafeTrackingUrl, isValidOptionalTrackingUrl } from "./trackingUrl.util";

describe("seller tracking URLs", () => {
  it("accepts blank optional values and valid HTTPS URLs", () => {
    assert.equal(isValidOptionalTrackingUrl("  "), true);
    assert.equal(isValidOptionalTrackingUrl(" https://carrier.example/track/123 "), true);
    assert.equal(getSafeTrackingUrl(" https://carrier.example/track/123 "), "https://carrier.example/track/123");
  });

  it("rejects non-HTTPS, hostless, credentialed, whitespace, and oversized URLs", () => {
    assert.equal(isValidOptionalTrackingUrl("http://carrier.example/track/123"), false);
    assert.equal(isValidOptionalTrackingUrl("https:///track/123"), false);
    assert.equal(isValidOptionalTrackingUrl("https://user:secret@carrier.example/track/123"), false);
    assert.equal(isValidOptionalTrackingUrl("https://carrier.example/track/one two"), false);
    assert.equal(isValidOptionalTrackingUrl(`https://carrier.example/${"x".repeat(300)}`), false);
  });

  it("does not expose an unsafe persisted URL as a clickable link", () => {
    assert.equal(getSafeTrackingUrl("javascript:alert(1)"), null);
  });
});
