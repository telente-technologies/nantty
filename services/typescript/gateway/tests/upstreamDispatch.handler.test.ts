import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";

interface RecordedUpstreamRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

const issuer = "https://auth.zudomart.test";
const audience = "zudomart-api";
const recorded: RecordedUpstreamRequest[] = [];
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let gatewayUrl: string;
let signingKey: CryptoKey;

async function signAccessToken(expiresIn: string): Promise<string> {
  return new SignJWT({ sid: "session-1", roles: ["buyer"] })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(issuer).setAudience(audience).setSubject("account-1").setIssuedAt().setExpirationTime(expiresIn)
    .sign(signingKey);
}

function buildConfig(upstreamUrl: string): GatewayConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: ["http://localhost:3000"],
    rateLimitMaxPerMinute: 0,
    upstreamTimeoutMs: 2_000,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer, audience },
    upstreams: { identity: upstreamUrl },
  };
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  signingKey = keyPair.privateKey;
  const publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "test-key", alg: "EdDSA" };
  upstream = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    request.on("end", () => {
      recorded.push({ method: request.method ?? "", url: request.url ?? "", headers: request.headers, body });
      response.writeHead(200, { "content-type": "application/json", "x-internal-secret": "must-not-leak" });
      response.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const verifier = new AccessTokenVerifier(buildConfig(upstreamUrl).accessToken, createLocalJWKSet({ keys: [publicJwk] }));
  gateway = createGatewayServer({ config: buildConfig(upstreamUrl), verifier });
  await gateway.start();
  gatewayUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("gateway upstream dispatch", () => {
  it("forwards public auth routes with body, query and request id, and strips spoofed identity headers", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/auth/login?client=mobile`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zudomart-account-id": "spoofed" },
      body: JSON.stringify({ identifier: "ada", password: "secret123" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-internal-secret")).toBeNull();
    const forwarded = recorded.at(-1);
    expect(forwarded?.url).toBe("/api/v1/auth/login?client=mobile");
    expect(JSON.parse(forwarded?.body ?? "{}")).toEqual({ identifier: "ada", password: "secret123" });
    expect(forwarded?.headers["x-request-id"]).toBeTruthy();
    expect(forwarded?.headers["x-zudomart-account-id"]).toBeUndefined();
  });

  it("rejects protected routes without a valid access token before reaching the upstream", async () => {
    const before = recorded.length;
    const missing = await fetch(`${gatewayUrl}/api/v1/auth/logout`, { method: "POST" });
    const expired = await fetch(`${gatewayUrl}/api/v1/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${await signAccessToken("-1m")}` } });
    expect(missing.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(recorded.length).toBe(before);
  });

  it("forwards the verified identity on protected routes", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${await signAccessToken("5m")}`, "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: null }),
    });
    expect(response.status).toBe(200);
    expect(recorded.at(-1)?.headers["x-zudomart-account-id"]).toBe("account-1");
    expect(recorded.at(-1)?.headers["x-zudomart-session-id"]).toBe("session-1");
  });

  it("lets refresh through with an expired access token attached", async () => {
    const response = await fetch(`${gatewayUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { authorization: `Bearer ${await signAccessToken("-1m")}`, "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "x".repeat(43) }),
    });
    expect(response.status).toBe(200);
    expect(recorded.at(-1)?.headers["x-zudomart-account-id"]).toBeUndefined();
  });

  it("returns 404 for routes without an upstream", async () => {
    expect((await fetch(`${gatewayUrl}/api/v1/unknown`)).status).toBe(404);
  });
});

describe("gateway upstream failures", () => {
  it("answers 502 when the upstream is unreachable", async () => {
    const unreachable = createGatewayServer({
      config: { ...buildConfig("http://127.0.0.1:1"), port: 0 },
      verifier: new AccessTokenVerifier(buildConfig("http://127.0.0.1:1").accessToken, createLocalJWKSet({ keys: [] })),
    });
    await unreachable.start();
    const response = await fetch(`http://127.0.0.1:${unreachable.address?.port}/api/v1/auth/login`, { method: "POST", body: "{}" });
    await unreachable.stop();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});
