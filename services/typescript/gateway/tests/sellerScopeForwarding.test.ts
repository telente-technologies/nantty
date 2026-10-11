import { describe, expect, it } from "vitest";

import { buildUpstreamRequestHeaders, type ProxiedRequest } from "../src/services/upstreamProxy.service.js";

const request = (headers: Record<string, string>): ProxiedRequest => ({ method: "GET", pathWithQuery: "/api/v1/seller/access", headers, body: undefined, requestId: "r1", clientIp: undefined, principal: undefined });

describe("seller scope forwarding", () => {
  it("passes the chosen store, location and concurrency headers upstream", () => {
    const headers = buildUpstreamRequestHeaders(request({ "x-seller-store": "store-2", "x-seller-location": "loc-1", "if-match": "\"v3\"", "x-chunk-sha256": "abc" }));
    expect(headers).toMatchObject({ "x-seller-store": "store-2", "x-seller-location": "loc-1", "if-match": "\"v3\"", "x-chunk-sha256": "abc" });
  });

  it("still drops headers that are not on the allowlist", () => {
    const headers = buildUpstreamRequestHeaders(request({ "x-seller-store-id": "spoofed", "x-internal-token": "spoofed" }));
    expect(headers["x-seller-store-id"]).toBeUndefined();
    expect(headers["x-internal-token"]).toBeUndefined();
  });

  it("drops a client-sent CDN country unless the gateway sits behind a CDN that overwrites it", () => {
    expect(buildUpstreamRequestHeaders(request({ "cloudfront-viewer-country": "GH" }))["cloudfront-viewer-country"]).toBeUndefined();
    const trusted = buildUpstreamRequestHeaders({ ...request({ "cloudfront-viewer-country": "NG" }), trustCdnCountryHeader: true });
    expect(trusted["cloudfront-viewer-country"]).toBe("NG");
  });
});
