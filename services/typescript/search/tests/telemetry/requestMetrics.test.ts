import { metrics } from "@opentelemetry/api";
import { MeterProvider, MetricReader, type HistogramMetricData } from "@opentelemetry/sdk-metrics";
import { createRequestContext, createRouter } from "@zudojs/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registerRoutes, type RouteDependencies } from "../../src/routes/index.js";
import { dispatchWithRoute, withRequestMetrics } from "../../src/telemetry/requestMetrics.js";
import { startTelemetry } from "../../src/telemetry/telemetry.js";

class CollectingReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

const reader = new CollectingReader();
beforeAll(() => void metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] })));
afterAll(() => metrics.disable());

const router = createRouter({});
registerRoutes(router, { probeDatabase: async () => undefined, probeBroker: async () => undefined } as unknown as RouteDependencies);
const handle = withRequestMetrics(async (request) => (await dispatchWithRoute(router, request, new AbortController().signal)).response);

async function durationPoints() {
  const { resourceMetrics } = await reader.collect();
  const metric = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics).find((entry) => entry.descriptor.name === "http.server.request.duration") as HistogramMetricData | undefined;
  return (metric?.dataPoints ?? []).map((point): Record<string, unknown> => ({ ...point.attributes, count: point.value.count }));
}

const get = (path: string) => createRequestContext({ method: "GET", url: path, path });

describe("request RED metrics", () => {
  it("records duration with the route template and status code", async () => {
    expect((await handle(get("/readyz"))).status).toBe(200);
    expect((await handle(get("/no/such/path/123"))).status).toBe(404);
    const points = await durationPoints();
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "/readyz", "http.response.status_code": 200, count: 1 });
    expect(points).toContainEqual({ "http.request.method": "GET", "http.route": "unmatched", "http.response.status_code": 404, count: 1 });
    expect(points.some((point) => String(point["http.route"]).includes("123"))).toBe(false);
  });

  it("startTelemetry is a no-op without an OTLP endpoint", async () => {
    const before = metrics.getMeterProvider();
    const stop = startTelemetry("search", {});
    expect(metrics.getMeterProvider()).toBe(before);
    await expect(stop()).resolves.toBeUndefined();
  });
});
