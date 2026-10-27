import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig, UpstreamName } from "../src/configs/gateway.config.js";
import { resolveUpstreamRouteForRequest, upstreamRoutes } from "../src/routes/upstream.routes.js";
import { classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { WidgetTokenVerifier, widgetTokenAudience, widgetTokenScope, type WidgetTokenRevocationSource } from "../src/services/widgetTokenVerifier.service.js";

const upstreamNames: readonly UpstreamName[] = ["identity", "live", "money", "notifications", "social", "trust", "commerce", "media", "search", "ads", "support"];
const issuer = "https://auth.nantty.test";

describe("widget route table", () => {
  it("only GET /api/v1/widgets/* routes accept a widget token", () => {
    for (const route of upstreamRoutes.filter((candidate) => candidate.acceptsWidgetToken === true)) {
      expect(route.pathPrefix.startsWith("/api/v1/widgets/")).toBe(true);
      expect(route.methods).toEqual(["GET"]);
      expect(route.authentication).toBe("required");
    }
  });

  it.each([
    ["/api/v1/widgets/orders", "commerce"],
    ["/api/v1/widgets/seller-today", "commerce"],
    ["/api/v1/widgets/live-now", "live"],
    ["/api/v1/widgets/creator-today", "money"],
    ["/api/v1/widgets/stories", "social"],
  ] as const)("%s goes to %s and is rate limited", (path, upstream) => {
    const route = resolveUpstreamRouteForRequest("GET", path);
    expect(route?.upstream).toBe(upstream);
    expect(route?.acceptsWidgetToken).toBe(true);
    expect(resolveUpstreamRouteForRequest("POST", path)).toBeUndefined();
    expect(classifyRequestForRateLimit("GET", path)).toBe("widgetRead");
  });

  it("issues widget tokens only to a signed-in session", () => {
    const route = resolveUpstreamRouteForRequest("POST", "/api/v1/auth/widget-token");
    expect(route?.upstream).toBe("identity");
    expect(route?.authentication).toBe("required");
    expect(route?.acceptsWidgetToken).not.toBe(true);
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/widget-token")).toBe("widgetToken");
  });
});

describe("widget token scope enforcement at the gateway", () => {
  let upstream: Server;
  let upstreamHits = 0;
  let lastHeaders: IncomingHttpHeaders = {};
  let gateway: ReturnType<typeof createGatewayServer>;
  let gatewayUrl: string;
  let privateKey: CryptoKey;
  const current = new Map<string, string>();
  const revocations: WidgetTokenRevocationSource = { isWidgetTokenCurrent: async (sessionId, tokenId) => current.get(sessionId) === tokenId };

  const signToken = (audience: string, claims: Record<string, unknown>, tokenId = "widget-1") =>
    new SignJWT({ sid: "session-1", ...claims }).setProtectedHeader({ alg: "EdDSA", kid: "test-key" }).setIssuer(issuer).setAudience(audience)
      .setSubject("account-1").setJti(tokenId).setIssuedAt().setExpirationTime("1h").sign(privateKey);
  const widgetToken = (tokenId = "widget-1") => signToken(widgetTokenAudience, { scope: widgetTokenScope }, tokenId);

  beforeAll(async () => {
    const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
    privateKey = keyPair.privateKey;
    const keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(keyPair.publicKey)), kid: "test-key", alg: "EdDSA" }] });
    upstream = createServer((request, response) => {
      upstreamHits += 1;
      lastHeaders = request.headers;
      request.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    const upstreams = Object.fromEntries(upstreamNames.map((name) => [name, url])) as GatewayConfig["upstreams"];
    const config: GatewayConfig = { host: "127.0.0.1", port: 0, corsOrigins: [], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience: "nantty-api" }, policyGate: null, guestRateLimits: { perMinute: 100_000, sensitivePerMinute: 100_000 }, upstreams, routeRateLimitsPerMinute: { widgetRead: 100_000, widgetToken: 100_000 } };
    gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, keySet), widgetVerifier: new WidgetTokenVerifier(config.accessToken, revocations, keySet) });
    await gateway.start();
    gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
  });

  afterAll(async () => {
    await gateway.stop();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  const call = async (method: string, path: string, token: string) => fetch(`${gatewayUrl}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(method === "GET" ? {} : { body: "{}" }) });

  it("forwards a current widget token to its widget endpoint with the account identity", async () => {
    current.set("session-1", "widget-1");
    const response = await call("GET", "/api/v1/widgets/stories", await widgetToken());
    expect(response.status).toBe(200);
    expect(lastHeaders["x-nantty-account-id"]).toBe("account-1");
  });

  it("accepts a normal session token on widget endpoints too", async () => {
    const response = await call("GET", "/api/v1/widgets/orders", await signToken("nantty-api", { roles: [] }));
    expect(response.status).toBe(200);
  });

  it.each([
    ["GET", "/api/v1/orders"],
    ["GET", "/api/v1/users/me"],
    ["GET", "/api/v1/auth/sessions"],
    ["POST", "/api/v1/auth/widget-token"],
    ["POST", "/api/v1/posts"],
    ["GET", "/api/v1/products"],
    ["GET", "/api/v1/stories/tray"],
    ["GET", "/api/v1/wallets/me"],
  ])("refuses a widget token on %s %s without reaching a service", async (method, path) => {
    current.set("session-1", "widget-1");
    const before = upstreamHits;
    const response = await call(method, path, await widgetToken());
    expect(response.status).toBe(401);
    expect(upstreamHits).toBe(before);
  });

  it.each([
    ["GET", "/api/v1/widgets/stories"],
    ["GET", "/api/v1/users/me"],
    ["POST", "/api/v1/auth/realtime-token"],
    ["POST", "/api/v1/seller/conversations/c1/messages"],
  ])("refuses a realtime socket token on %s %s without reaching a service", async (method, path) => {
    const before = upstreamHits;
    expect((await call(method, path, await signToken("nantty-realtime", { scope: "realtime" }, "rt-1"))).status).toBe(401);
    expect((await call(method, path, await signToken("nantty-api", { scope: "realtime" }, "rt-2"))).status).toBe(401);
    expect(upstreamHits).toBe(before);
  });

  it("routes realtime token issuance to identity for signed-in sessions only", () => {
    const route = resolveUpstreamRouteForRequest("POST", "/api/v1/auth/realtime-token");
    expect(route?.upstream).toBe("identity");
    expect(route?.authentication).toBe("required");
    expect(route?.acceptsWidgetToken).not.toBe(true);
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/realtime-token")).toBe("widgetToken");
  });

  it("refuses rotated, revoked and mis-scoped widget tokens", async () => {
    const before = upstreamHits;
    current.set("session-1", "widget-2");
    expect((await call("GET", "/api/v1/widgets/stories", await widgetToken("widget-1"))).status).toBe(401);
    current.delete("session-1");
    expect((await call("GET", "/api/v1/widgets/stories", await widgetToken("widget-2"))).status).toBe(401);
    current.set("session-1", "widget-3");
    expect((await call("GET", "/api/v1/widgets/stories", await signToken(widgetTokenAudience, { scope: "orders:write" }, "widget-3"))).status).toBe(401);
    expect(upstreamHits).toBe(before);
  });
});
