import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createResponseContext, type HttpRequestContext } from "@nantty/fastify-platform";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import { loadGatewayConfigFromEnvironment, type GatewayConfig } from "../src/configs/gateway.config.js";
import { collectProductionHardeningProblems } from "../src/configs/productionHardening.config.js";
import { createRequestSizeLimitMiddleware } from "../src/middlewares/requestSizeLimit.middleware.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { buildIdentitySigningPayload } from "../src/services/gatewayIdentitySigner.service.js";
import { IdentityPolicyGateSource, doesRequestNeedPolicyGate } from "../src/services/policyAcceptanceGate.service.js";
import { InMemoryRateLimitStore } from "../src/services/rateLimitStore.service.js";
import { CachedChallengeStateSource } from "../src/services/security/humanVerificationGate.service.js";
import { InMemorySecurityStore } from "../src/services/security/securityStore.service.js";
import type { ChallengeState, TrustSecurityClient } from "../src/services/security/securitySignalSink.service.js";

const issuer = "https://auth.nantty.test";
let signingKey: CryptoKey;
let verifier: AccessTokenVerifier;
let upstream: Server;
let upstreamUrl: string;
const forwardedPaths: string[] = [];
const servers: ReturnType<typeof createGatewayServer>[] = [];

function sign(audience: string, subject = "account-1"): Promise<string> {
  return new SignJWT({ sid: "session-1" }).setProtectedHeader({ alg: "EdDSA", kid: "k1" }).setIssuer(issuer).setAudience(audience).setSubject(subject).setIssuedAt().setExpirationTime("5m").sign(signingKey);
}

function configFor(overrides: Partial<GatewayConfig>): GatewayConfig {
  return {
    host: "127.0.0.1", port: 0, corsOrigins: [], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience: "nantty-api" },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
    ...overrides,
  };
}

async function startGateway(overrides: Partial<GatewayConfig>): Promise<string> {
  const gateway = createGatewayServer({ config: configFor(overrides), verifier });
  await gateway.start();
  servers.push(gateway);
  return `http://127.0.0.1:${gateway.address?.port}`;
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  signingKey = keyPair.privateKey;
  verifier = new AccessTokenVerifier({ jwksUrl: "http://unused.invalid", issuer, audience: "nantty-api" }, createLocalJWKSet({ keys: [{ ...(await exportJWK(keyPair.publicKey)), kid: "k1", alg: "EdDSA" }] }));
  upstream = createServer((request, response) => {
    forwardedPaths.push(request.url ?? "");
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const server of servers) await server.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("C1 proxy trust", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  const required = { AUTH_JWKS_URL: "http://identity/jwks.json", AUTH_TOKEN_ISSUER: "http://identity", GATEWAY_IDENTITY_SECRET: "s".repeat(40), UPSTREAM_IDENTITY_URL: "http://identity" };

  it("trusts no forwarded hop unless configured", () => {
    Object.assign(process.env, required);
    delete process.env["TRUSTED_PROXY_HOPS"];
    expect(loadGatewayConfigFromEnvironment().trustedProxyHops).toBe(0);
  });

  it("refuses to reuse the staff audience for user access tokens", () => {
    Object.assign(process.env, required, { AUTH_TOKEN_AUDIENCE: "nantty-admin" });
    expect(() => loadGatewayConfigFromEnvironment()).toThrow(/AUTH_TOKEN_AUDIENCE must not equal the staff audience/);
  });

  it("refuses to start in production without an explicit hop count", () => {
    const adminToken = { ADMIN_INTERNAL_API_TOKEN: "a".repeat(40) };
    expect(collectProductionHardeningProblems({ NODE_ENV: "production", ...adminToken })).toEqual([expect.stringMatching(/TRUSTED_PROXY_HOPS/)]);
    expect(collectProductionHardeningProblems({ NODE_ENV: "production", TRUSTED_PROXY_HOPS: "1", ...adminToken })).toEqual([]);
    expect(collectProductionHardeningProblems({ NODE_ENV: "production", TRUSTED_PROXY_HOPS: "1" })).toEqual([expect.stringMatching(/ADMIN_INTERNAL_API_TOKEN/)]);
  });

  it("keeps one bucket when the right-most X-Forwarded-For entry rotates and no proxy is trusted", async () => {
    const base = await startGateway({ routeRateLimitsPerMinute: { login: 2 } });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push((await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${attempt + 1}` }, body: "{}" })).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("H2 placeholder secrets", () => {
  it("rejects the published local-only values and short tokens in production", () => {
    const problems = collectProductionHardeningProblems({ NODE_ENV: "production", TRUSTED_PROXY_HOPS: "1", GATEWAY_IDENTITY_SECRET: "local-only-gateway-identity-secret-0123456789", IDENTITY_INTERNAL_TOKEN: "short", TRUST_INTERNAL_TOKEN: "local-only-moderation-internal-token-0123456789", ADMIN_INTERNAL_API_TOKEN: "local-only-admin-internal-token-0123456789" });
    expect(problems).toHaveLength(4);
    expect(collectProductionHardeningProblems({ NODE_ENV: "development", GATEWAY_IDENTITY_SECRET: "local-only-gateway-identity-secret-0123456789" })).toEqual([]);
  });
});

describe("H1 admin routes need a staff token at the gateway", () => {
  it("refuses missing, garbage and customer tokens and forwards a verified staff token", async () => {
    const base = await startGateway({});
    const customer = await sign("nantty-api");
    const staff = await sign("nantty-admin", "staff-1");
    expect((await fetch(`${base}/api/v1/admin/withdrawals`)).status).toBe(401);
    expect((await fetch(`${base}/api/v1/admin/refunds`, { method: "POST", headers: { authorization: "Bearer garbage" }, body: "{}" })).status).toBe(401);
    expect((await fetch(`${base}/api/v1/admin/ledger/entries`, { headers: { authorization: `Bearer ${customer}` } })).status).toBe(401);
    expect((await fetch(`${base}/api/v1/admin/ledger/entries`, { headers: { authorization: `Bearer ${staff}` } })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/admin/auth/me`)).status).toBe(401);
  });

  it("answers a bare admin OPTIONS at the edge without reaching any upstream", async () => {
    const base = await startGateway({});
    const forwardedBefore = forwardedPaths.length;
    for (const path of ["/api/v1/admin/ledger/entries", "/api/v1/admin/withdrawals/w1/approve", "/api/v1/admin/support/tickets", "/api/v1/admin/auth/login"]) {
      const response = await fetch(`${base}${path}`, { method: "OPTIONS" });
      expect(response.status, path).toBe(204);
      expect(await response.text(), path).toBe("");
    }
    expect(forwardedPaths.length).toBe(forwardedBefore);
  });

  it("rejects tokens whose subject carries control characters", async () => {
    expect(await verifier.verifyAccessTokenWithJwks(await sign("nantty-api", "account-1\nx-nantty-viewer"))).toBeUndefined();
  });
});

describe("H3 gate lookups keep the last restrictive answer", () => {
  it("serves a cached acceptance requirement when identity is down", async () => {
    let now = 0;
    let fail = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      if (fail) throw new Error("identity down");
      return new Response(JSON.stringify({ acceptanceRequired: true, documentKeys: ["terms"] }), { status: 200 });
    }) as typeof fetch;
    try {
      const source = new IdentityPolicyGateSource("http://identity", "t", 1_000, () => now);
      expect((await source.readGate("a1")).acceptanceRequired).toBe(true);
      now = 60_000;
      fail = true;
      expect(await source.readGate("a1")).toEqual({ acceptanceRequired: true, documentKeys: ["terms"] });
      await expect(source.readGate("a2")).rejects.toThrow(/identity down/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("serves a cached challenge requirement when trust is down", async () => {
    let now = 0;
    let state: ChallengeState | Error = { requirement: "everyAction", reason: "suspected_bot" };
    const trust = { readChallengeState: async () => { if (state instanceof Error) throw state; return state; } } as unknown as TrustSecurityClient;
    const source = new CachedChallengeStateSource(trust, 1_000, () => now);
    await source.read("a1");
    now = 60_000;
    state = new Error("trust down");
    expect((await source.read("a1")).requirement).toBe("everyAction");
    await expect(source.read("a2")).rejects.toThrow(/trust down/);
  });
});

describe("H4 guest limit ignores client device headers", () => {
  it("does not mint a new bucket per X-Device-Id", async () => {
    const base = await startGateway({ guestRateLimits: { perMinute: 1000, sensitivePerMinute: 2 } });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) statuses.push((await fetch(`${base}/api/v1/feeds/popular`, { headers: { "x-device-id": `device-${attempt}`, "x-client-region": `r${attempt}` } })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("M2/M4 counters", () => {
  it("keeps other counters when the security store overflows", async () => {
    const store = new InMemorySecurityStore();
    await store.put("victim", 600);
    for (let index = 0; index < 50_010; index += 1) await store.recordInWindow(`flood-${index}`, "m", 60);
    expect(await store.has("victim")).toBe(true);
  });

  it("does not allow a double burst across the window boundary", async () => {
    let now = 59_000;
    const store = new InMemoryRateLimitStore(() => now);
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await store.hit("k", 5, 60)).allowed).toBe(true);
    now = 61_000;
    const allowedAfterBoundary = [];
    for (let attempt = 0; attempt < 5; attempt += 1) allowedAfterBoundary.push((await store.hit("k", 5, 60)).allowed);
    expect(allowedAfterBoundary.filter(Boolean).length).toBe(0);
    now = 180_000;
    expect((await store.hit("k", 5, 60)).allowed).toBe(true);
  });
});

describe("M5/M7/M8/M9 edges", () => {
  it("refuses a non-numeric Content-Length", async () => {
    const middleware = createRequestSizeLimitMiddleware(10);
    const request = { getHeader: (name: string) => (name === "content-length" ? "abc" : undefined), body: undefined } as unknown as HttpRequestContext;
    const response = await middleware({ request, response: createResponseContext() } as never, async () => createResponseContext({ status: 200 }));
    expect((response as { status: number }).status).toBe(400);
  });

  it("refuses identity fields with line breaks", () => {
    expect(() => buildIdentitySigningPayload({ method: "GET", path: "/p", requestId: "r", issuedAtSeconds: 1, headers: { "x-nantty-account-id": "a\nb" } })).toThrow();
  });

  it("network-gates the bare admin prefix", async () => {
    const base = await startGateway({ adminIpAllowList: ["203.0.113.0/24"] });
    const response = await fetch(`${base}/api/v1/admin`);
    expect(response.status).toBe(403);
  });

  it("matches policy-gate exemptions by path segment", () => {
    expect(doesRequestNeedPolicyGate("POST", "/api/v1/consents")).toBe(false);
    expect(doesRequestNeedPolicyGate("POST", "/api/v1/consents/abc")).toBe(false);
    expect(doesRequestNeedPolicyGate("POST", "/api/v1/consentsfoo")).toBe(true);
  });
});

describe("S2 link preview limit", () => {
  it("classifies link preview resolution and refresh as an account-scoped limit", async () => {
    const { classifyRequestForRateLimit, buildRouteRateLimitKey } = await import("../src/services/routeRateLimitPolicy.service.js");
    expect(classifyRequestForRateLimit("GET", "/api/v1/link-previews/resolve")).toBe("linkPreview");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/link-preview")).toBe("linkPreview");
    expect(buildRouteRateLimitKey("linkPreview", "1.2.3.4", "acct")).toBe("rl:route:linkPreview:a:acct");
  });
});

describe("S3 social write limits", () => {
  it("classifies comment, engagement, message, conversation and support writes", async () => {
    const { classifyRequestForRateLimit, buildRouteRateLimitKey, defaultRouteLimitsPerMinute } = await import("../src/services/routeRateLimitPolicy.service.js");
    expect(classifyRequestForRateLimit("POST", "/api/v1/mentions/resolve")).toBe("mentionsResolve");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/comments")).toBe("commentWrite");
    expect(classifyRequestForRateLimit("DELETE", "/api/v1/comments/c1")).toBe("commentWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/like")).toBe("postEngagement");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/impressions")).toBe("postEngagement");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/media/m1/download")).toBe("mediaDownload");
    expect(classifyRequestForRateLimit("POST", "/api/v1/conversations/c1/messages")).toBe("messageWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/messages/m1/reactions")).toBe("messageWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/conversations/c1/members")).toBe("conversationWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/chat/keys/claim")).toBe("messagingKeys");
    expect(classifyRequestForRateLimit("POST", "/api/v1/support/tickets")).toBe("supportWrite");
    expect(classifyRequestForRateLimit("POST", "/api/v1/admin/support/email/bulk-send")).toBe("adminEmail");
    expect(classifyRequestForRateLimit("POST", "/api/v1/email/unsubscribe")).toBe("unsubscribe");
    expect(buildRouteRateLimitKey("commentWrite", "1.2.3.4", "acct")).toBe("rl:route:commentWrite:a:acct");
    expect(buildRouteRateLimitKey("unsubscribe", "1.2.3.4", undefined)).toBe("rl:route:unsubscribe:i:1.2.3.4");
    expect(defaultRouteLimitsPerMinute.mentionsResolve).toBeLessThanOrEqual(20);
  });
});

describe("M6 CORS answers are rate limited", () => {
  it("enforces the global limit under a bounded concurrent request burst", async () => {
    const base = await startGateway({ rateLimitMaxPerMinute: 5 });
    const statuses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/api/v1/feeds/popular`).then((response) => response.status)));
    expect(statuses.filter((status) => status === 200)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(15);
  });

  it("counts preflights and rejected origins once each against the global limit", async () => {
    const base = await startGateway({ corsOrigins: ["https://app.nantty.test"], rateLimitMaxPerMinute: 3 });
    const preflight = { method: "OPTIONS", headers: { origin: "https://app.nantty.test", "access-control-request-method": "POST" } };
    const statuses = [
      (await fetch(`${base}/api/v1/feeds/popular`, preflight)).status,
      (await fetch(`${base}/api/v1/feeds/popular`, { headers: { origin: "https://evil.example" } })).status,
      (await fetch(`${base}/api/v1/feeds/popular`, { headers: { origin: "https://app.nantty.test" } })).status,
      (await fetch(`${base}/api/v1/feeds/popular`, preflight)).status,
    ];
    expect(statuses).toEqual([204, 403, 200, 429]);
  });
});
