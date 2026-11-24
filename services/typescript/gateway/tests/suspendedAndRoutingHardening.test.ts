import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";

let identityServer: Server;
let socialServer: Server;
let commerceServer: Server;
let mediaServer: Server;
let trustServer: Server;
let upstreamHits: Record<string, number>;
let gateway: ReturnType<typeof createGatewayServer>;
let gatewayUrl: string;
let privateKey: CryptoKey;

async function startStub(name: string): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    upstreamHits[name] = (upstreamHits[name] ?? 0) + 1;
    request.resume();
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ upstream: name, path: request.url }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function mintToken(options: { roles: string[]; audience?: string }): Promise<string> {
  return new SignJWT({ sid: "sess-1", roles: options.roles, age: "adult" })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setSubject("acc-1")
    .setIssuer("https://auth.nantty.test")
    .setAudience(options.audience ?? "nantty-api")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

beforeAll(async () => {
  upstreamHits = {};
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  privateKey = keyPair.privateKey;
  const publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "test-key", alg: "EdDSA" };

  const idStub = await startStub("identity");
  const socStub = await startStub("social");
  const comStub = await startStub("commerce");
  const medStub = await startStub("media");
  const truStub = await startStub("trust");
  identityServer = idStub.server;
  socialServer = socStub.server;
  commerceServer = comStub.server;
  mediaServer = medStub.server;
  trustServer = truStub.server;

  const config: GatewayConfig = {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: [],
    rateLimitMaxPerMinute: 0,
    upstreamTimeoutMs: 2_000,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    policyGate: null,
    guestRateLimits: { perMinute: 100_000, sensitivePerMinute: 100_000 },
    upstreams: {
      identity: idStub.url,
      live: idStub.url,
      money: idStub.url,
      notifications: idStub.url,
      social: socStub.url,
      trust: truStub.url,
      commerce: comStub.url,
      media: medStub.url,
      search: socStub.url,
      ads: comStub.url,
      support: idStub.url,
    },
  };
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [publicJwk] })) });
  await gateway.start();
  gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  for (const server of [identityServer, socialServer, commerceServer, mediaServer, trustServer]) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("gateway suspended-account enforcement, messenger auth & analytics routing", () => {
  it("blocks suspended principals from social, chat, media, and commerce routes before touching upstreams", async () => {
    const suspendedToken = await mintToken({ roles: ["user", "suspended"] });
    const socialBefore = upstreamHits["social"] ?? 0;
    const mediaBefore = upstreamHits["media"] ?? 0;
    const commerceBefore = upstreamHits["commerce"] ?? 0;

    for (const [method, path] of [
      ["GET", "/api/v1/conversations"],
      ["POST", "/api/v1/conversations/conv-1/messages"],
      ["POST", "/api/v1/posts"],
      ["POST", "/api/v1/media/uploads"],
      ["POST", "/api/v1/orders/checkout"],
    ] as const) {
      const response = await fetch(`${gatewayUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${suspendedToken}`, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message: "This account has been suspended.", code: "ACCOUNT_SUSPENDED" });
    }
    expect(upstreamHits["social"] ?? 0).toBe(socialBefore);
    expect(upstreamHits["media"] ?? 0).toBe(mediaBefore);
    expect(upstreamHits["commerce"] ?? 0).toBe(commerceBefore);
  });

  it("still allows suspended principals to view suspension status, submit appeals, and log out", async () => {
    const suspendedToken = await mintToken({ roles: ["user", "suspended"] });
    for (const [method, path] of [
      ["GET", "/api/v1/users/me/suspension"],
      ["POST", "/api/v1/users/me/suspension/appeal"],
      ["GET", "/api/v1/users/me/data-exports"],
      ["POST", "/api/v1/users/me/data-exports"],
      ["GET", "/api/v1/users/me/data-exports/exp-1"],
      ["GET", "/api/v1/account/status"],
      ["POST", "/api/v1/account/status/strikes/st-1/appeal"],
      ["GET", "/api/v1/moderation/decisions/me"],
      ["POST", "/api/v1/moderation/decisions/rep-1/appeal"],
      ["POST", "/api/v1/live-safety/live-1/appeal"],
      ["POST", "/api/v1/auth/logout"],
    ] as const) {
      const response = await fetch(`${gatewayUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${suspendedToken}`, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      });
      expect(response.status).toBe(200);
    }
  });

  it("allows anonymous messenger device authorization & SSO token exchange and applies auth rate limits", async () => {
    for (const path of [
      "/api/v1/auth/messenger/authorizations",
      "/api/v1/auth/messenger/authorizations/auth-1/verify-code",
      "/api/v1/auth/messenger/authorizations/auth-1/complete",
      "/api/v1/auth/messenger/authorizations/auth-1/recovery/email",
      "/api/v1/auth/messenger/authorizations/auth-1/recovery/verify",
      "/api/v1/auth/sso/token",
    ]) {
      const response = await fetch(`${gatewayUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(response.status).toBe(200);
    }

    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/messenger/authorizations")).toBe("login");
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/messenger/authorizations/auth-1/verify-code")).toBe("otp");
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/messenger/authorizations/auth-1/recovery/email")).toBe("otpSend");
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/messenger/authorizations/auth-1/recovery/verify")).toBe("otp");
  });

  it("routes GET /api/v1/admin/analytics/overview and analytics endpoints to commerce instead of identity", async () => {
    const staffToken = await mintToken({ roles: ["admin"], audience: "nantty-admin" });
    const staffResponse = await fetch(`${gatewayUrl}/api/v1/admin/analytics/overview`, {
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(staffResponse.status).toBe(200);
    expect(await staffResponse.json()).toEqual({ upstream: "commerce", path: "/api/v1/admin/analytics/overview" });

    const userToken = await mintToken({ roles: ["user"] });
    for (const [method, path] of [
      ["GET", "/api/v1/analytics/creator/summary?window=30d"],
      ["GET", "/api/v1/analytics/seller/summary?storeId=str_1&window=30d"],
      ["POST", "/api/v1/analytics/events"],
    ] as const) {
      const response = await fetch(`${gatewayUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ upstream: "commerce", path });
    }
  });
});
