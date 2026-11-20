import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";

let upstreamHits = 0;
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let base: string;

function buildConfig(upstreamUrl: string): GatewayConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: ["https://app.nantty.test"],
    rateLimitMaxPerMinute: 0,
    upstreamTimeoutMs: 2_000,
    policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    upstreams: {
      identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl,
      trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl,
    },
  };
}

beforeAll(async () => {
  upstream = createServer((_request, response) => {
    upstreamHits += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const config = buildConfig(upstreamUrl);
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [] })) });
  await gateway.start();
  base = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("gateway path confusion & parser differential defenses", () => {
  it.each([
    "//evil.example/api/v1/auth/login",
    "//api/v1/admin/users",
    "/api/v1//admin/users",
    "/api/v1//auth/login",
    "/api/v1/%61dmin/users",
    "/api/v1/admin/../internal/users",
    "/api/v1/auth/%2e%2e/internal/users",
  ])("blocks path confusion probe %s before reaching upstreams", async (path) => {
    const before = upstreamHits;
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(404);
    expect(upstreamHits).toBe(before);
  });
});
