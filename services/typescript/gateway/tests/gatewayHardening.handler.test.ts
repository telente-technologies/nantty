import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { isInternalOnlyPath } from "../src/services/internalRouteGuard.service.js";
import { AccessTokenVerifier } from "../src/services/accessTokenVerifier.service.js";
import { InMemoryRateLimitStore } from "../src/services/rateLimitStore.service.js";
import { classifyRequestForRateLimit } from "../src/services/routeRateLimitPolicy.service.js";
import { startGatewaySpan } from "../src/services/traceContext.service.js";
import { ValkeyRateLimitStore } from "../src/services/valkeyRateLimitStore.service.js";

interface Recorded { readonly url: string; readonly headers: IncomingHttpHeaders; readonly body: Buffer }

const recorded: Recorded[] = [];
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let base: string;

function buildConfig(upstreamUrl: string): GatewayConfig {
  return {
    host: "127.0.0.1", port: 0, corsOrigins: ["https://app.zudomart.test"], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null,
    guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.zudomart.test", audience: "zudomart-api" },
    maxRequestBodyBytes: 2048,
    routeRateLimitsPerMinute: { login: 2, search: 3 },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
}

beforeAll(async () => {
  upstream = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      recorded.push({ url: request.url ?? "", headers: request.headers, body: Buffer.concat(chunks) });
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
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

describe("webhook passthrough", () => {
  it("forwards the exact bytes and signature header to go-money", async () => {
    const payload = '{ "event" :"charge.completed",\n  "data":{"amount":  5000}  }';
    const response = await fetch(`${base}/webhooks/flutterwave`, { method: "POST", headers: { "content-type": "application/json", "flutterwave-signature": "abc123" }, body: payload });
    expect(response.status).toBe(200);
    const forwarded = recorded.at(-1);
    expect(forwarded?.url).toBe("/webhooks/flutterwave");
    expect(forwarded?.body.toString("utf8")).toBe(payload);
    expect(forwarded?.headers["flutterwave-signature"]).toBe("abc123");
  });

  it("forwards the Flutterwave verif-hash header to go-money", async () => {
    const payload = '{"event":"charge.completed","data":{"id":1}}';
    const response = await fetch(`${base}/webhooks/flutterwave`, { method: "POST", headers: { "content-type": "application/json", "verif-hash": "hash-value" }, body: payload });
    expect(response.status).toBe(200);
    expect(recorded.at(-1)?.headers["verif-hash"]).toBe("hash-value");
  });

  it("does not forward signature headers on ordinary routes", async () => {
    await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { "flutterwave-signature": "abc123", "verif-hash": "hash-value", "content-type": "application/json" }, body: "{}" });
    expect(recorded.at(-1)?.headers["flutterwave-signature"]).toBeUndefined();
    expect(recorded.at(-1)?.headers["verif-hash"]).toBeUndefined();
  });
});

describe("internal routes", () => {
  it.each(["/internal/health", "/api/v1/auth/internal/token", "/api/v1/admin/%2e%2e/internal/x", "/api/v1/auth/%2569nternal/x", "/api/v1/auth/INTERNAL/x"])("hides %s", async (path) => {
    const before = recorded.length;
    expect((await fetch(`${base}${path}`)).status).toBe(404);
    expect(recorded.length).toBe(before);
  });

  it("only flags whole internal segments", () => {
    expect(isInternalOnlyPath("/api/v1/posts/internals")).toBe(false);
    expect(isInternalOnlyPath("/api/v1/x/internal")).toBe(true);
  });
});

describe("per-route rate limits", () => {
  it("limits login per ip and leaves other routes alone", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) statuses.push((await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status);
    expect(statuses).toEqual([200, 200, 429]);
    expect((await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(200);
  });

  it("classifies the sensitive routes", () => {
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/otp/send")).toBe("otp");
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/password/reset")).toBe("reset");
    expect(classifyRequestForRateLimit("POST", "/api/v1/auth/register")).toBe("signup");
    expect(classifyRequestForRateLimit("GET", "/api/v1/auth/username-available?username=ada")).toBe("usernameCheck");
    expect(classifyRequestForRateLimit("GET", "/api/v1/auth/username-suggestion?seed=ada")).toBe("usernameCheck");
    expect(classifyRequestForRateLimit("GET", "/api/v1/tags/candidates?q=a")).toBe("tagSearch");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts/p1/media/m1/download")).toBe("mediaDownload");
    expect(classifyRequestForRateLimit("POST", "/api/v1/posts")).toBe("postWrite");
    expect(classifyRequestForRateLimit("PUT", "/api/v1/posts/abc/tags")).toBe("postWrite");
    expect(classifyRequestForRateLimit("DELETE", "/api/v1/posts/abc/tags/me")).toBe("postWrite");
    expect(classifyRequestForRateLimit("GET", "/api/v1/posts/abc/tagged-users")).toBeUndefined();
    expect(classifyRequestForRateLimit("POST", "/api/v1/reports")).toBe("report");
    expect(classifyRequestForRateLimit("POST", "/api/v1/media/uploads")).toBe("upload");
    expect(classifyRequestForRateLimit("GET", "/api/v1/search/people")).toBe("search");
    expect(classifyRequestForRateLimit("GET", "/api/v1/auth/login")).toBeUndefined();
  });

  it("uses valkey counters and falls back to memory when valkey fails", async () => {
    const counts = new Map<string, number>();
    const store = new ValkeyRateLimitStore({
      command: async (args) => {
        const key = String(args[3]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return [counts.get(key) ?? 0, 0];
      },
    }, new InMemoryRateLimitStore(), () => undefined, () => 1_000_000_040_000);
    expect((await store.hit("k", 1, 60)).allowed).toBe(true);
    expect(await store.hit("k", 1, 60)).toEqual({ allowed: false, retryAfterSeconds: 40 });
    let failures = 0;
    const broken = new ValkeyRateLimitStore({ command: async () => { throw new Error("down"); } }, new InMemoryRateLimitStore(), () => { failures += 1; });
    expect((await broken.hit("k", 1, 60)).allowed).toBe(true);
    expect((await broken.hit("k", 1, 60)).allowed).toBe(false);
    expect(failures).toBe(1);
  });
});

describe("headers, cors, size and tracing", () => {
  it("sets security headers and a request id", async () => {
    const response = await fetch(`${base}/healthz`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("allows only configured origins", async () => {
    const allowed = await fetch(`${base}/healthz`, { headers: { origin: "https://app.zudomart.test" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://app.zudomart.test");
    const denied = await fetch(`${base}/healthz`, { headers: { origin: "https://evil.test" } });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    const preflight = await fetch(`${base}/api/v1/posts`, { method: "OPTIONS", headers: { origin: "https://app.zudomart.test", "access-control-request-method": "POST" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Idempotency-Key");
  });

  it("rejects oversized bodies", async () => {
    const response = await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blob: "x".repeat(4096) }) });
    expect(response.status).toBe(413);
  });

  it("propagates and extends an incoming traceparent", async () => {
    const incoming = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { traceparent: incoming, "content-type": "application/json" }, body: "{}" });
    const forwarded = recorded.at(-1)?.headers["traceparent"] as string;
    expect(forwarded).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    expect(forwarded).not.toBe(incoming);
  });

  it("starts a new trace for missing or malformed traceparent", () => {
    expect(startGatewaySpan(undefined).traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(startGatewaySpan("garbage").traceId).toHaveLength(32);
  });
});
