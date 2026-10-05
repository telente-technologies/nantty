import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";

let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let base: string;

beforeAll(async () => {
  upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const config: GatewayConfig = {
    host: "127.0.0.1", port: 0, corsOrigins: ["https://app.zudomart.test"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 }, trustedProxyHops: 1,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.zudomart.test", audience: "zudomart-api" },
    routeRateLimitsPerMinute: { login: 2 },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [] })) });
  await gateway.start();
  base = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("client ip trust", () => {
  it("does not let a caller dodge per-ip limits by forging X-Forwarded-For", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const headers = { "content-type": "application/json", "x-forwarded-for": `198.51.100.${attempt + 1}, 203.0.113.9` };
      statuses.push((await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers, body: "{}" })).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("verification start limit", () => {
  it("classifies verification requests and captures as their own per-account limit", async () => {
    const { classifyRequestForRateLimit, buildRouteRateLimitKey } = await import("../src/services/routeRateLimitPolicy.service.js");
    expect(classifyRequestForRateLimit("POST", "/api/v1/verification/eligibility/request")).toBe("verification");
    expect(classifyRequestForRateLimit("POST", "/api/v1/verification/cases/c1/capture")).toBe("verification");
    expect(classifyRequestForRateLimit("GET", "/api/v1/verification/journey")).toBeUndefined();
    expect(buildRouteRateLimitKey("verification", "1.2.3.4", "acct")).toBe("rl:route:verification:a:acct");
  });
});
