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
  { pathPrefix: "/api/v1/auth/", upstream: "identity", authentication: "optional" },
];

export function resolveUpstreamRouteForRequest(method: string, path: string, routes: readonly UpstreamRoute[] = upstreamRoutes): UpstreamRoute | undefined {
  return routes.find(
    (route) => (path === route.pathPrefix || path.startsWith(route.pathPrefix.endsWith("/") ? route.pathPrefix : `${route.pathPrefix}/`))
      && (route.methods === undefined || route.methods.includes(method.toUpperCase())),
  );
}
