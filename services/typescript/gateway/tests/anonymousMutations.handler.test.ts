import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { upstreamRoutes } from "../src/routes/upstream.routes.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { isAnonymousMutationAllowed } from "../src/services/anonymousMutationGuard.service.js";

const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"] as const;
let upstream: Server;
let upstreamHits = 0;
let gateway: ReturnType<typeof createGatewayServer>;
let gatewayUrl: string;

function buildConfig(upstreamUrl: string): GatewayConfig {
  const upstreams = { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl };
  return { host: "127.0.0.1", port: 0, corsOrigins: [], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.zudomart.test", audience: "zudomart-api" }, policyGate: null, guestRateLimits: { perMinute: 100_000, sensitivePerMinute: 100_000 }, upstreams };
}

function buildConcretePath(pathPrefix: string): string {
  const withIds = pathPrefix.replaceAll("*", "id_1");
  return withIds.endsWith("/") ? `${withIds}x` : withIds;
}

function listEveryMutatingRoute(): ReadonlyArray<readonly [string, string]> {
  const cases = new Map<string, readonly [string, string]>();
  for (const route of upstreamRoutes) {
    const path = buildConcretePath(route.pathPrefix);
    for (const method of (route.methods ?? mutatingMethods).filter((candidate) => (mutatingMethods as readonly string[]).includes(candidate))) {
      cases.set(`${method} ${path}`, [method, path]);
      if (route.exactPathOnly !== true) cases.set(`${method} ${path}/child`, [method, `${path}/child`]);
    }
  }
  return [...cases.values()];
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "test-key", alg: "EdDSA" };
  upstream = createServer((request, response) => {
    upstreamHits += 1;
    request.resume();
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const config = buildConfig(`http://127.0.0.1:${(upstream.address() as AddressInfo).port}`);
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [publicJwk] })) });
  await gateway.start();
  gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("guests are view-only at the gateway", () => {
  const cases = listEveryMutatingRoute();

  it("covers every mutating route in the table", () => {
    expect(cases.length).toBeGreaterThan(150);
  });

  it.each(cases)("anonymous %s %s is refused unless it is an auth, consent or webhook endpoint", async (method, path) => {
    const before = upstreamHits;
    const response = await fetch(`${gatewayUrl}${path}`, { method, headers: { "content-type": "application/json" }, body: "{}" });
    if (isAnonymousMutationAllowed(path)) {
      expect(response.status).not.toBe(401);
      return;
    }
    expect([401, 404]).toContain(response.status);
    expect(upstreamHits).toBe(before);
  });

  it("rejects a forged or expired bearer token on a mutation", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/posts/p1/like`, { method: "POST", headers: { authorization: "Bearer not-a-real-token" } });
    expect(response.status).toBe(401);
  });

  it("still lets guests read public content", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/posts/p1`);
    expect(response.status).toBe(200);
  });

  it.each([
    ["POST", "/api/v1/auth/login"],
    ["POST", "/api/v1/auth/register"],
    ["PUT", "/api/v1/consents"],
    ["POST", "/webhooks/flutterwave"],
  ])("lets anonymous %s %s through", async (method, path) => {
    const response = await fetch(`${gatewayUrl}${path}`, { method, headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(200);
  });
});
