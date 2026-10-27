import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig, UpstreamName } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";

const issuer = "https://auth.nantty.test";
const audience = "nantty-api";
const upstreamNames: readonly UpstreamName[] = ["identity", "live", "money", "notifications", "social", "trust", "commerce", "media", "search", "ads", "support"];
const hits: { upstream: UpstreamName; method: string; url: string; accountId: string | undefined }[] = [];
const upstreamServers: Server[] = [];
let gateway: ReturnType<typeof createGatewayServer>;
let gatewayUrl: string;
let signingKey: CryptoKey;

async function startRecordingUpstream(name: UpstreamName): Promise<string> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const accountId = request.headers["x-nantty-account-id"];
      hits.push({ upstream: name, method: request.method ?? "", url: request.url ?? "", accountId: typeof accountId === "string" ? accountId : undefined });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ upstream: name }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  upstreamServers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function signAccessToken(): Promise<string> {
  return new SignJWT({ sid: "session-1", roles: ["buyer"] })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(issuer).setAudience(audience).setSubject("account-1").setIssuedAt().setExpirationTime("5m")
    .sign(signingKey);
}

async function send(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; upstream: UpstreamName | undefined }> {
  const before = hits.length;
  const headers: Record<string, string> = { "content-type": "application/json", "idempotency-key": "flow-key-0001" };
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  const response = await fetch(`${gatewayUrl}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  await response.arrayBuffer();
  return { status: response.status, upstream: hits.length > before ? hits[hits.length - 1]?.upstream : undefined };
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  signingKey = keyPair.privateKey;
  const publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "test-key", alg: "EdDSA" };
  const upstreams = Object.fromEntries(await Promise.all(upstreamNames.map(async (name) => [name, await startRecordingUpstream(name)] as const))) as Record<UpstreamName, string>;
  const config: GatewayConfig = {
    host: "127.0.0.1", port: 0, corsOrigins: ["http://localhost:3000"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience }, policyGate: null,
    guestRateLimits: { perMinute: 120, sensitivePerMinute: 30 }, upstreams,
  };
  gateway = createGatewayServer({ config, verifier: new AccessTokenVerifier(config.accessToken, createLocalJWKSet({ keys: [publicJwk] })) });
  await gateway.start();
  gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await Promise.all(upstreamServers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("critical flows reach the owning service with no legacy monolith in the path", () => {
  it("login goes to go-identity without a token", async () => {
    expect(await send("POST", "/api/v1/auth/login", undefined, { identifier: "ada@example.com", password: "secret123" })).toEqual({ status: 200, upstream: "identity" });
  });

  it("the For You feed is open to guests and served by ts-social", async () => {
    expect(await send("GET", "/api/v1/feeds/for-you")).toEqual({ status: 200, upstream: "social" });
  });

  it("checkout needs a signed-in buyer and is served by go-commerce with the verified account id", async () => {
    expect(await send("POST", "/api/v1/orders/checkout", undefined, { addressId: "a1" })).toEqual({ status: 401, upstream: undefined });
    const token = await signAccessToken();
    expect(await send("POST", "/api/v1/orders/checkout", token, { addressId: "a1" })).toEqual({ status: 200, upstream: "commerce" });
    expect(hits.at(-1)?.accountId).toBe("account-1");
    expect(await send("GET", "/api/v1/cart", token)).toEqual({ status: 200, upstream: "commerce" });
  });

  it("wallet reads and withdrawals need a token and go to go-money", async () => {
    expect(await send("GET", "/api/v1/wallets/me")).toEqual({ status: 401, upstream: undefined });
    const token = await signAccessToken();
    expect(await send("GET", "/api/v1/wallets/me", token)).toEqual({ status: 200, upstream: "money" });
    expect(await send("POST", "/api/v1/wallets/me/withdrawals", token, { amountMinor: 100000 })).toEqual({ status: 200, upstream: "money" });
  });

  it("encrypted chat, its key directory and creator brand deals reach their owners", async () => {
    expect(await send("GET", "/api/v1/conversations")).toEqual({ status: 401, upstream: undefined });
    const token = await signAccessToken();
    expect(await send("GET", "/api/v1/conversations", token)).toEqual({ status: 200, upstream: "social" });
    expect(await send("POST", "/api/v1/chat/keys/devices/query", token, { userIds: ["u1"] })).toEqual({ status: 200, upstream: "social" });
    expect(await send("POST", "/api/v1/creators/brand-deals", token, { brandName: "Ankara Co" })).toEqual({ status: 200, upstream: "money" });
  });

  it("routes the old monolith served but nobody owns now are not forwarded anywhere", async () => {
    const token = await signAccessToken();
    for (const path of ["/api/v1/waitlist", "/api/v1/loyalty/me", "/api/v1/referrals/me", "/api/v1/realtime/tickets"]) {
      const result = path.endsWith("/me") ? await send("GET", path, token) : await send("POST", path, token, {});
      expect(result.upstream, path).toBeUndefined();
      expect(result.status, path).toBe(404);
    }
  });
});
