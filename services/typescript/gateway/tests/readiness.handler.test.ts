import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";

let upstreamHits = 0;
let upstream: Server;
let upstreamUrl = "";
const gateways: ReturnType<typeof createGatewayServer>[] = [];

function buildConfig(valkeyUrl: string | null): GatewayConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: ["http://localhost:3000"],
    rateLimitMaxPerMinute: 1,
    upstreamTimeoutMs: 2_000,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    policyGate: null,
    valkeyUrl,
    guestRateLimits: { perMinute: 120, sensitivePerMinute: 3 },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
}

async function startGateway(valkeyUrl: string | null): Promise<string> {
  const gateway = createGatewayServer({ config: buildConfig(valkeyUrl) });
  gateways.push(gateway);
  await gateway.start();
  return `http://127.0.0.1:${gateway.address?.port}`;
}

async function closedPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

beforeAll(async () => {
  upstream = createServer((_request, response) => {
    upstreamHits += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const gateway of gateways) await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("gateway /readyz", () => {
  it("answers ready locally without forwarding upstream or being rate limited", async () => {
    const base = await startGateway(null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${base}/readyz`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ready" });
    }
    expect(upstreamHits).toBe(0);
  });

  it("stays ready but reports a degraded cache when valkey is unreachable", async () => {
    const base = await startGateway(`redis://127.0.0.1:${await closedPort()}`);
    const response = await fetch(`${base}/readyz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", cache: "degraded" });
    expect(upstreamHits).toBe(0);
  });
});
