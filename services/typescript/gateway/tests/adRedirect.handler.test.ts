import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { isSafeRedirectLocation } from "../src/services/upstreamProxy.service.js";

const locations: Record<string, string> = {
  "/api/v1/ads/r/good": "https://shop.example.com/sale?utm_source=nantty",
  "/api/v1/ads/r/app": "nantty://product/p1",
  "/api/v1/ads/r/evil": "javascript:alert(1)",
  "/api/v1/ads/campaigns": "https://elsewhere.example.com/",
};
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let gatewayUrl: string;

beforeAll(async () => {
  upstream = createServer((request, response) => {
    response.writeHead(302, { location: locations[request.url ?? ""] ?? "https://fallback.example.com/" });
    response.end();
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const config: GatewayConfig = {
    host: "127.0.0.1", port: 0, corsOrigins: ["http://localhost:3000"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    guestRateLimits: { perMinute: 120, sensitivePerMinute: 3 },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, async () => { throw new Error("no keys"); }) });
  await gateway.start();
  gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("ad click redirects through the gateway", () => {
  it("passes a vetted https or in-app target to anonymous viewers", async () => {
    const web = await fetch(`${gatewayUrl}/api/v1/ads/r/good`, { redirect: "manual" });
    expect(web.status).toBe(302);
    expect(web.headers.get("location")).toBe("https://shop.example.com/sale?utm_source=nantty");
    const app = await fetch(`${gatewayUrl}/api/v1/ads/r/app`, { redirect: "manual" });
    expect(app.headers.get("location")).toBe("nantty://product/p1");
  });

  it("refuses an unsafe target instead of becoming an open redirect", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/ads/r/evil`, { redirect: "manual" });
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("never forwards a redirect on other routes", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/ads/campaigns`, { redirect: "manual" });
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("accepts only https with a host and no credentials, or the app scheme", () => {
    expect(isSafeRedirectLocation("https://a.example.com/x")).toBe(true);
    expect(isSafeRedirectLocation("nantty://messages")).toBe(true);
    for (const unsafe of ["http://a.example.com", "//evil.example.com", "/relative", "https://user:pass@a.example.com", "data:text/html,x", "https://a.example.com/\\evil"]) {
      expect(isSafeRedirectLocation(unsafe)).toBe(false);
    }
  });
});
