import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { metrics } from "@opentelemetry/api";
import { MeterProvider, MetricReader, type HistogramMetricData } from "@opentelemetry/sdk-metrics";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import { startTelemetry } from "../src/telemetry/telemetry.js";

class CollectingReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

const reader = new CollectingReader();
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let baseUrl = "";

beforeAll(async () => {
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const config: GatewayConfig = {
    host: "127.0.0.1",
    port: 0,
    corsOrigins: ["http://localhost:3000"],
    rateLimitMaxPerMinute: 100,
    upstreamTimeoutMs: 2_000,
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    policyGate: null,
    valkeyUrl: null,
    guestRateLimits: { perMinute: 120, sensitivePerMinute: 30 },
    upstreams: { identity: upstreamUrl, live: upstreamUrl, money: upstreamUrl, notifications: upstreamUrl, social: upstreamUrl, trust: upstreamUrl, commerce: upstreamUrl, media: upstreamUrl, search: upstreamUrl, ads: upstreamUrl, support: upstreamUrl },
  };
  gateway = createGatewayServer({ config });
  await gateway.start();
  baseUrl = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  metrics.disable();
});

async function durationPoints() {
  const { resourceMetrics } = await reader.collect();
  const metric = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics).find((entry) => entry.descriptor.name === "http.server.request.duration") as HistogramMetricData | undefined;
  return (metric?.dataPoints ?? []).map((point): Record<string, unknown> => ({ ...point.attributes, count: point.value.count }));
}

describe("request RED metrics", () => {
  it("records duration with the route template and status code", async () => {
    expect((await fetch(`${baseUrl}/healthz`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/v1/legal/policy-versions/current?lang=en`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/no/such/path/123`)).status).toBe(404);
    const points = await durationPoints();
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "/healthz", "http.response.status_code": 200, count: 1 });
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "/api/v1/legal/policy-versions/current", "http.response.status_code": 200, count: 1 });
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "unmatched", "http.response.status_code": 404, count: 1 });
    expect(points.some((point) => String(point["http.route"]).includes("123"))).toBe(false);
  });

  it("startTelemetry is a no-op without an OTLP endpoint", async () => {
    const before = metrics.getMeterProvider();
    const stop = startTelemetry("gateway", {});
    expect(metrics.getMeterProvider()).toBe(before);
    await expect(stop()).resolves.toBeUndefined();
  });
});
