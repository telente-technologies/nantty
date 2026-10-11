import { metrics, type Histogram, type MeterProvider } from "@opentelemetry/api";
import type { HttpRequestContext, HttpResponseContext } from "@zudojs/http";

const knownMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const routes = new WeakMap<object, string>();
let cached: { readonly provider: MeterProvider; readonly histogram: Histogram } | undefined;

function requestDuration(): Histogram {
  const provider = metrics.getMeterProvider();
  if (cached?.provider !== provider) {
    cached = { provider, histogram: provider.getMeter("zudomart.http").createHistogram("http.server.request.duration", { unit: "s", description: "Duration of HTTP server requests." }) };
  }
  return cached.histogram;
}

export function markRequestRoute(request: object, route: string | undefined): void {
  if (route !== undefined && route !== "") routes.set(request, route);
}

export function withRequestMetrics(handler: (request: HttpRequestContext) => Promise<HttpResponseContext>) {
  return async (request: HttpRequestContext): Promise<HttpResponseContext> => {
    const startedAt = performance.now();
    let status = 500;
    try {
      const response = await handler(request);
      status = response.status;
      return response;
    } finally {
      requestDuration().record((performance.now() - startedAt) / 1000, {
        "http.request.method": knownMethods.has(request.method) ? request.method : "_OTHER",
        "http.route": routes.get(request) ?? "unmatched",
        "http.response.status_code": status,
      });
    }
  };
}
