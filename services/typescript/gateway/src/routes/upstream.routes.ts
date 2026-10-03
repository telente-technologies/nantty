import type { UpstreamName } from "../configs/gateway.config.js";

export type AuthenticationRequirement = "required" | "optional";

export interface UpstreamRoute {
  readonly pathPrefix: string;
  readonly upstream: UpstreamName;
  readonly authentication: AuthenticationRequirement;
  readonly methods?: readonly string[];
}

export const upstreamRoutes: readonly UpstreamRoute[] = [
  { pathPrefix: "/api/v1/auth/logout", upstream: "identity", authentication: "required", methods: ["POST"] },
  { pathPrefix: "/api/v1/auth/sessions", upstream: "identity", authentication: "required" },
  { pathPrefix: "/api/v1/auth/password/change", upstream: "identity", authentication: "required", methods: ["POST"] },
  { pathPrefix: "/api/v1/auth/", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/users/", upstream: "identity", authentication: "required" },
  { pathPrefix: "/api/v1/business-categories", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/geo/", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/policies/", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/consents", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/locale", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/currencies", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/currency/", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/platform-config/", upstream: "identity", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/gifts", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/lives", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/battles/", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/live/", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/gifts", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/rankings", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/creators/me/analytics/gifts/", upstream: "live", authentication: "required" },
  { pathPrefix: "/api/v1/admin/", upstream: "identity", authentication: "optional" },
];

export function resolveUpstreamRouteForRequest(method: string, path: string, routes: readonly UpstreamRoute[] = upstreamRoutes): UpstreamRoute | undefined {
  return routes.find(
    (route) => (path === route.pathPrefix || path.startsWith(route.pathPrefix.endsWith("/") ? route.pathPrefix : `${route.pathPrefix}/`))
      && (route.methods === undefined || route.methods.includes(method.toUpperCase())),
  );
}
