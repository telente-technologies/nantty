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
  { pathPrefix: "/api/v1/payments/", upstream: "money", authentication: "required" },
  { pathPrefix: "/api/v1/coins/packages", upstream: "money", authentication: "optional", methods: ["GET"] },
  { pathPrefix: "/api/v1/coins/packs", upstream: "money", authentication: "optional", methods: ["GET"] },
  { pathPrefix: "/api/v1/coins/", upstream: "money", authentication: "required" },
  { pathPrefix: "/api/v1/wallets/", upstream: "money", authentication: "required" },
  { pathPrefix: "/api/v1/banks", upstream: "money", authentication: "required" },
  { pathPrefix: "/api/v1/orders/*/escrow", upstream: "money", authentication: "required", methods: ["GET"] },
  { pathPrefix: "/api/v1/orders/*/disputes", upstream: "money", authentication: "required", methods: ["POST"] },
  { pathPrefix: "/api/v1/disputes", upstream: "money", authentication: "required" },
  { pathPrefix: "/api/v1/creators/earnings/convert", upstream: "money", authentication: "required", methods: ["POST"] },
  { pathPrefix: "/api/v1/admin/ledger/", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/payments/", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/orders/*/escrow", upstream: "money", authentication: "optional", methods: ["GET"] },
  { pathPrefix: "/api/v1/admin/orders/*/escrow/refund", upstream: "money", authentication: "optional", methods: ["POST"] },
  { pathPrefix: "/api/v1/admin/disputes", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/withdrawals", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/payouts/", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/creator-tiers", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/creators/", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/coins/", upstream: "money", authentication: "optional" },
  { pathPrefix: "/api/v1/admin/", upstream: "identity", authentication: "optional" },
];

function doesPathMatchRoute(path: string, routePath: string): boolean {
  if (routePath.includes("*")) {
    const routeSegments = routePath.split("/");
    const pathSegments = path.split("/");
    return routeSegments.length === pathSegments.length
      && routeSegments.every((segment, index) => (segment === "*" ? (pathSegments[index] ?? "") !== "" : segment === pathSegments[index]));
  }
  return path === routePath || path.startsWith(routePath.endsWith("/") ? routePath : `${routePath}/`);
}

export function resolveUpstreamRouteForRequest(method: string, path: string, routes: readonly UpstreamRoute[] = upstreamRoutes): UpstreamRoute | undefined {
  return routes.find((route) => doesPathMatchRoute(path, route.pathPrefix) && (route.methods === undefined || route.methods.includes(method.toUpperCase())));
}
