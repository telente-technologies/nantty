import { metrics } from "@opentelemetry/api";
import { MeterProvider, MetricReader, type HistogramMetricData } from "@opentelemetry/sdk-metrics";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlatform } from "@nantty/fastify-platform";

import { registerRoutes, type RouteDependencies } from "../../src/routes/index.js";
import { startTelemetry } from "../../src/telemetry/telemetry.js";

class CollectingReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

const reader = new CollectingReader();
beforeAll(() => void metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] })));
afterAll(() => metrics.disable());

async function durationPoints() {
  const { resourceMetrics } = await reader.collect();
  const metric = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics).find((entry) => entry.descriptor.name === "http.server.request.duration") as HistogramMetricData | undefined;
  return (metric?.dataPoints ?? []).map((point): Record<string, unknown> => ({ ...point.attributes, count: point.value.count }));
}

describe("request RED metrics", () => {
  it("records duration with the route template and status code", async () => {
    const app = await createPlatform({ name: "metrics-test", host: "127.0.0.1", port: 0, logger: false, rateLimit: false });
    registerRoutes(app, { probeDatabase: async () => undefined, probeBroker: async () => undefined } as unknown as RouteDependencies);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/no/such/path/123" })).statusCode).toBe(404);
    const points = await durationPoints();
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "/readyz", "http.response.status_code": 200, count: 1 });
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "unmatched", "http.response.status_code": 404, count: 1 });
    expect(points.some((point) => String(point["http.route"]).includes("123"))).toBe(false);
    await app.close();
  });

  it("startTelemetry is a no-op without an OTLP endpoint", async () => {
    const before = metrics.getMeterProvider();
    const stop = startTelemetry("search", {});
    expect(metrics.getMeterProvider()).toBe(before);
    await expect(stop()).resolves.toBeUndefined();
  });
});
