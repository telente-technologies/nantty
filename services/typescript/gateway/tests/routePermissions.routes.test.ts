import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig, UpstreamName } from "../src/configs/gateway.config.js";
import { resolveUpstreamRouteForRequest, upstreamRoutes } from "../src/routes/upstream.routes.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";

const upstreamNames: readonly UpstreamName[] = ["identity", "live", "money", "notifications", "social", "trust", "commerce", "media", "search", "ads", "support"];
const httpMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];

describe("every gateway route declares its access rule", () => {
  it.each(upstreamRoutes.map((route) => [route.pathPrefix, route] as const))("%s", (_path, route) => {
    expect(["required", "optional"]).toContain(route.authentication);
    expect(upstreamNames).toContain(route.upstream);
    expect(route.pathPrefix.startsWith("/api/v1/") || route.pathPrefix === "/webhooks/").toBe(true);
    for (const method of route.methods ?? []) expect(httpMethods).toContain(method);
  });

  it("never exposes internal service routes", () => {
    for (const route of upstreamRoutes) expect(route.pathPrefix).not.toMatch(/^\/(api\/v1\/)?internal\b/);
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/internal/users/u1/notification-recipient")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/internal/v1/media/m1")).toBeUndefined();
  });

  it("has no catch-all, so unknown paths are not forwarded", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/nothing-here")).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("GET", "/api/v2/users/me")).toBeUndefined();
  });

  it("sends staff console paths to services that verify staff tokens (gateway auth is optional there)", () => {
    for (const route of upstreamRoutes.filter((candidate) => candidate.pathPrefix.startsWith("/api/v1/admin/"))) expect(route.authentication).toBe("optional");
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/admin/audit-events")?.upstream).toBe("identity");
  });
});

describe("anonymous requests to protected routes", () => {
  let upstream: Server;
  let upstreamHits = 0;
  let gateway: ReturnType<typeof createGatewayServer>;
  let gatewayUrl: string;

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
    const url = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    const upstreams = Object.fromEntries(upstreamNames.map((name) => [name, url])) as GatewayConfig["upstreams"];
    const config: GatewayConfig = { host: "127.0.0.1", port: 0, corsOrigins: [], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.zudomart.test", audience: "zudomart-api" }, policyGate: null, guestRateLimits: { perMinute: 100_000, sensitivePerMinute: 100_000 }, upstreams };
    gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [publicJwk] })) });
    await gateway.start();
    gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
  });

  afterAll(async () => {
    await gateway.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  const protectedRoutes: ReadonlyArray<readonly [string, string]> = [
    ["GET", "/api/v1/users/me"],
    ["GET", "/api/v1/auth/sessions"],
    ["GET", "/api/v1/notifications"],
    ["GET", "/api/v1/notifications/unread-count"],
    ["GET", "/api/v1/conversations"],
    ["POST", "/api/v1/conversations"],
    ["GET", "/api/v1/messages/unread-count"],
    ["GET", "/api/v1/support/tickets"],
    ["POST", "/api/v1/support/tickets"],
    ["GET", "/api/v1/search/recent"],
    ["POST", "/api/v1/media/uploads"],
  ];

  it.each(protectedRoutes)("%s %s answers 401 without reaching a service", async (method, path) => {
    const before = upstreamHits;
    const response = await fetch(`${gatewayUrl}${path}`, { method, ...(method === "GET" ? {} : { headers: { "content-type": "application/json" }, body: "{}" }) });
    expect(response.status).toBe(401);
    expect(upstreamHits).toBe(before);
  });

  it("rejects a forged bearer token the same way", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/users/me`, { headers: { authorization: "Bearer not-a-token" } });
    expect(response.status).toBe(401);
  });
});
