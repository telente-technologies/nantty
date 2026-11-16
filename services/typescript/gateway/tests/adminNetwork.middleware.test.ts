import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { isValidAllowListEntry } from "../src/middlewares/adminNetwork.middleware.js";
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
    host: "127.0.0.1", port: 0, corsOrigins: ["https://admin.nantty.test"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 }, trustedProxyHops: 1, adminIpAllowList: ["203.0.113.0/24", "2001:db8::/32"], blockedClientIps: ["203.0.114.0/24", "2001:db8:dead::/48"],
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
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

async function statusFrom(path: string, clientIp: string): Promise<{ status: number; code?: string }> {
  const response = await fetch(`${base}${path}`, { headers: { "x-forwarded-for": clientIp } });
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return { status: response.status, ...(body.code === undefined ? {} : { code: body.code }) };
}

describe("admin network allow-list", () => {
  it("refuses every admin route from outside the allow-list, whatever service owns it", async () => {
    expect(await statusFrom("/api/v1/admin/reports", "198.51.100.7")).toEqual({ status: 403, code: "IP_NOT_ALLOWED" });
    expect(await statusFrom("/api/v1/admin/withdrawals", "198.51.100.7")).toEqual({ status: 403, code: "IP_NOT_ALLOWED" });
    expect((await statusFrom("/api/v1/admin/reports", "203.0.113.20")).status).not.toBe(403);
    expect((await statusFrom("/api/v1/admin/auth/me", "2001:db8::5")).status).not.toBe(403);
  });

  it("leaves non-admin routes alone", async () => {
    expect((await statusFrom("/api/v1/feed", "192.0.2.44")).status).not.toBe(403);
  });

  it("blocks configured IPv4 and IPv6 ranges across the gateway", async () => {
    expect(await statusFrom("/api/v1/feed", "203.0.114.7")).toEqual({ status: 403, code: "IP_BLOCKED" });
    expect(await statusFrom("/api/v1/feed", "2001:db8:dead::5")).toEqual({ status: 403, code: "IP_BLOCKED" });
    expect((await statusFrom("/api/v1/feed", "203.0.113.7")).status).not.toBe(403);
  });

  it("validates entries", () => {
    expect(["10.0.0.1", "10.0.0.0/8", "2001:db8::/32"].every(isValidAllowListEntry)).toBe(true);
    expect(["10.0.0.0/33", "300.1.1.1", "10.0.0.0/8/1", "10.0.0.0/x"].some(isValidAllowListEntry)).toBe(false);
  });
});
