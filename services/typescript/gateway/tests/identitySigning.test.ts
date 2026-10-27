import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildUpstreamRequestHeaders, type ProxiedRequest } from "../src/services/upstreamProxy.service.js";

const secret = "test-gateway-identity-secret-0123456789abcdef";
const request = (overrides: Partial<ProxiedRequest>): ProxiedRequest => ({ method: "POST", pathWithQuery: "/api/v1/posts?draft=1", headers: {}, body: undefined, requestId: "r1", clientIp: undefined, principal: undefined, ...overrides });

function expectedSignature(headers: Record<string, string>, method: string, path: string): string {
  const issuedAt = /^t=(\d+),/.exec(headers["x-nantty-identity-signature"] ?? "")?.[1] ?? "";
  const payload = ["v1", issuedAt, method, path, headers["x-request-id"] ?? "", headers["x-nantty-account-id"] ?? "", headers["x-nantty-session-id"] ?? "", headers["x-nantty-age-bracket"] ?? "", headers["x-nantty-viewer"] ?? ""].join("\n");
  return `t=${issuedAt},v1=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("gateway identity signing", () => {
  it("signs the verified principal, method, path and request id", () => {
    const headers = buildUpstreamRequestHeaders(request({ principal: { accountId: "acc-1", sessionId: "sid-1", roles: [], ageBracket: "adult" } }), secret);
    expect(headers["x-nantty-identity-signature"]).toBe(expectedSignature(headers, "POST", "/api/v1/posts"));
    const issuedAt = Number(/^t=(\d+),/.exec(headers["x-nantty-identity-signature"] ?? "")?.[1]);
    expect(Math.abs(issuedAt - Date.now() / 1000)).toBeLessThan(5);
  });

  it("signs anonymous context so a forged viewer header cannot pass", () => {
    const headers = buildUpstreamRequestHeaders(request({ headers: { "x-nantty-account-id": "spoofed", "x-nantty-identity-signature": "t=1,v1=00" } }), secret);
    expect(headers["x-nantty-account-id"]).toBeUndefined();
    expect(headers["x-nantty-viewer"]).toBe("anonymous");
    expect(headers["x-nantty-identity-signature"]).toBe(expectedSignature(headers, "POST", "/api/v1/posts"));
  });

  it("adds no signature when no secret is configured", () => {
    expect(buildUpstreamRequestHeaders(request({}))["x-nantty-identity-signature"]).toBeUndefined();
  });
});
