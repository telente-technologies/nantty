import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

const id = "0192f0a0-0000-7000-8000-0000000000bb";

describe("catalog routes", () => {
  it("serves anonymous mart reads from commerce", () => {
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/mart/highlights")).toMatchObject({ upstream: "commerce", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/sitemap/products")).toMatchObject({ upstream: "commerce", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/sitemap/stores")).toMatchObject({ upstream: "commerce", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/sitemap/profiles")?.upstream).toBe("identity");
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/categories/${id}`)).toMatchObject({ upstream: "commerce", authentication: "optional" });
    expect(resolveUpstreamRouteForRequest("GET", `/api/v1/brands/${id}/products`)).toMatchObject({ upstream: "commerce", authentication: "optional" });
  });

  it("requires a session for brand writes, seller applications and review deletion", () => {
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/brands")).toMatchObject({ upstream: "commerce", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", `/api/v1/brands/${id}/follow`)).toMatchObject({ upstream: "commerce", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/seller/applications")).toMatchObject({ upstream: "commerce", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/seller/applications/me")).toMatchObject({ upstream: "commerce", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("DELETE", `/api/v1/reviews/${id}`)).toMatchObject({ upstream: "commerce", authentication: "required" });
    expect(resolveUpstreamRouteForRequest("POST", "/api/v1/seller/products/import")).toMatchObject({ upstream: "commerce", authentication: "required" });
  });

  it("sends catalog admin routes to commerce before the identity catch-all", () => {
    for (const path of ["/api/v1/admin/catalog/categories", `/api/v1/admin/catalog/features/${id}/move`, `/api/v1/admin/brands/${id}`, `/api/v1/admin/applications/sellers/${id}/approve`]) {
      expect(resolveUpstreamRouteForRequest("POST", path)?.upstream).toBe("commerce");
    }
    expect(resolveUpstreamRouteForRequest("POST", `/api/v1/admin/stores/${id}/status`)?.upstream).toBe("commerce");
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/admin/catalog/topics")?.upstream).toBe("identity");
    expect(resolveUpstreamRouteForRequest("GET", "/api/v1/admin/applications/creators")?.upstream).toBe("identity");
  });

  it("never exposes catalog internal routes", () => {
    expect(resolveUpstreamRouteForRequest("GET", `/internal/v1/stores/${id}/members/${id}`)).toBeUndefined();
    expect(resolveUpstreamRouteForRequest("POST", `/internal/v1/stores/${id}/products/ownership`)).toBeUndefined();
  });
});
