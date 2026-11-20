import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractTrustedClientIpFromHeaders } from "../server/requestOriginGuard.service";
import { isAddressInAllowList } from "../utils/ipAllowList.util";

describe("admin client IP extraction", () => {
  it("ignores spoofed left-most X-Forwarded-For entries and uses the right-most trusted hop", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.5, 198.51.100.42" });
    const clientIp = extractTrustedClientIpFromHeaders(headers, 1);
    assert.equal(clientIp, "198.51.100.42");
    assert.equal(isAddressInAllowList(["10.0.0.0/8"], clientIp), false);
  });

  it("supports configurable multi-hop proxy chains from the right", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.1, 198.51.100.9, 172.16.0.4" });
    assert.equal(extractTrustedClientIpFromHeaders(headers, 2), "198.51.100.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": " 198.51.100.7 " });
    assert.equal(extractTrustedClientIpFromHeaders(headers, 1), "198.51.100.7");
  });
});
