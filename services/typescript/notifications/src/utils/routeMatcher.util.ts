import type { RouteDefinition } from "../types/route.type.js";

export function matchRoute(routes: readonly RouteDefinition[], method: string, path: string): { readonly route: RouteDefinition; readonly params: Record<string, string> } | undefined {
  const pathSegments = path.split("/").filter(Boolean);
  for (const route of routes) {
    if (route.method !== method.toUpperCase()) continue;
    const routeSegments = route.path.split("/").filter(Boolean);
    if (routeSegments.length !== pathSegments.length) continue;
    const params: Record<string, string> = {};
    const matches = routeSegments.every((segment, index) => {
      const actual = pathSegments[index] ?? "";
      if (segment.startsWith(":")) {
        params[segment.slice(1)] = decodeURIComponent(actual);
        return actual !== "";
      }
      return segment === actual;
    });
    if (matches) return { route, params };
  }
  return undefined;
}
