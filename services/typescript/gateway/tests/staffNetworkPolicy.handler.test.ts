import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { IdentityStaffNetworkPolicySource, StaffNetworkGate } from "../src/services/staffNetworkPolicy.service.js";

const issuer = "https://auth.nantty.test";
const internalToken = "admin-internal-token-for-tests-0001";
let upstream: Server;
let upstreamUrl = "";
let signingKey: CryptoKey;
let verifier: AccessTokenVerifier;
let policyCalls = 0;
let reachedUpstream = 0;
const started: ReturnType<typeof createGatewayServer>[] = [];

beforeAll(async () => {
  upstream = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://identity");
    response.setHeader("content-type", "application/json");
    if (url.pathname.endsWith("/network-policy")) {
      policyCalls += 1;
      if (request.headers["x-internal-token"] !== internalToken) {
        response.statusCode = 401;
        response.end("{}");
        return;
      }
      response.end(JSON.stringify({ allowed: (url.searchParams.get("address") ?? "").startsWith("203.0.113.") }));
      return;
    }
    reachedUpstream += 1;
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  signingKey = keyPair.privateKey;
  const publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "k1", alg: "EdDSA" };
  verifier = new AccessTokenVerifier({ jwksUrl: "http://unused.invalid/jwks.json", issuer, audience: "nantty-api" }, createLocalJWKSet({ keys: [publicJwk] }));
});

afterAll(async () => {
  for (const gateway of started) await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

function configFor(identityUrl: string, token: string, failClosed: boolean): GatewayConfig {
  return {
    host: "127.0.0.1", port: 0, corsOrigins: ["https://admin.nantty.test"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 }, trustedProxyHops: 1, staffNetworkPolicy: { internalToken: token, failClosed },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience: "nantty-api" },
    upstreams: { identity: identityUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
}

async function startGateway(config: GatewayConfig): Promise<string> {
  const gateway = createGatewayServer({ config, verifier });
  await gateway.start();
  started.push(gateway);
  return `http://127.0.0.1:${gateway.address?.port}`;
}

async function staffToken(staffId: string): Promise<string> {
  return new SignJWT({ sid: "staff-session-1", roles: ["admin", "perm:support:tickets"] }).setProtectedHeader({ alg: "EdDSA", kid: "k1" })
    .setIssuer(issuer).setAudience("nantty-admin").setSubject(staffId).setIssuedAt().setExpirationTime("5m").sign(signingKey);
}

async function callAdmin(base: string, path: string, clientIp: string, token: string): Promise<{ status: number; code?: string }> {
  const response = await fetch(`${base}${path}`, { headers: { "x-forwarded-for": clientIp, authorization: `Bearer ${token}` } });
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return { status: response.status, ...(body.code === undefined ? {} : { code: body.code }) };
}

describe("per-staff IP allow-list at the gateway", () => {
  it("refuses an office-only staff member on TS-service admin routes from another network and caches the decision", async () => {
    const base = await startGateway(configFor(upstreamUrl, internalToken, true));
    const token = await staffToken("staff-office-only");
    policyCalls = 0;
    reachedUpstream = 0;
    expect(await callAdmin(base, "/api/v1/admin/support/tickets", "198.51.100.7", token)).toEqual({ status: 403, code: "IP_NOT_ALLOWED" });
    expect(await callAdmin(base, "/api/v1/admin/notifications/templates", "198.51.100.7", token)).toEqual({ status: 403, code: "IP_NOT_ALLOWED" });
    expect(reachedUpstream).toBe(0);
    expect((await callAdmin(base, "/api/v1/admin/support/tickets", "203.0.113.20", token)).status).toBe(200);
    expect((await callAdmin(base, "/api/v1/admin/support/tickets", "203.0.113.20", token)).status).toBe(200);
    expect(policyCalls).toBe(2);
  });

  it("fails closed in production when the policy cannot be read or is not configured", async () => {
    const token = await staffToken("staff-any");
    const unreachable = await startGateway(configFor("http://127.0.0.1:9", internalToken, true));
    expect(await callAdmin(unreachable, "/api/v1/admin/support/tickets", "203.0.113.20", token)).toEqual({ status: 503, code: "UNAVAILABLE" });
    const unconfigured = await startGateway(configFor(upstreamUrl, "", true));
    expect(await callAdmin(unconfigured, "/api/v1/admin/support/tickets", "203.0.113.20", token)).toEqual({ status: 503, code: "UNAVAILABLE" });
    const development = await startGateway(configFor(upstreamUrl, "", false));
    expect((await callAdmin(development, "/api/v1/admin/support/tickets", "198.51.100.7", token)).status).toBe(200);
  });

  it("treats a refused policy call as unavailable, never as allowed", async () => {
    const gate = new StaffNetworkGate(new IdentityStaffNetworkPolicySource(upstreamUrl, "wrong-token"), false);
    expect(await gate.refuse("staff-any", "203.0.113.20")).toMatchObject({ status: 503 });
  });
});
