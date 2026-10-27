import { describe, expect, it } from "vitest";

import { readAgeBracketClaim } from "../src/services/accessTokenVerifier.service.js";
import { buildUpstreamRequestHeaders, type ProxiedRequest } from "../src/services/upstreamProxy.service.js";

const request = (overrides: Partial<ProxiedRequest>): ProxiedRequest => ({ method: "GET", pathWithQuery: "/api/v1/feeds/for-you", headers: {}, body: undefined, requestId: "r1", clientIp: undefined, principal: undefined, ...overrides });

describe("age bracket forwarding", () => {
  it("forwards only the verified token's bracket and never a client-supplied one", () => {
    const spoofed = { "x-nantty-age-bracket": "adult" };
    expect(buildUpstreamRequestHeaders(request({ headers: spoofed }))["x-nantty-age-bracket"]).toBe("unknown");
    expect(buildUpstreamRequestHeaders(request({ headers: spoofed, principal: { accountId: "a", sessionId: "s", roles: [], ageBracket: "minor" } }))["x-nantty-age-bracket"]).toBe("minor");
    expect(buildUpstreamRequestHeaders(request({ principal: { accountId: "a", sessionId: "s", roles: [] } }))["x-nantty-age-bracket"]).toBe("unknown");
  });

  it("reads the age claim without accepting anything but adult or minor", () => {
    expect(readAgeBracketClaim("adult")).toBe("adult");
    expect(readAgeBracketClaim("minor")).toBe("minor");
    expect(readAgeBracketClaim("2001-01-01")).toBe("unknown");
    expect(readAgeBracketClaim(undefined)).toBe("unknown");
  });
});
