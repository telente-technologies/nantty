import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, registerUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, type ApiResponse } from "../src/apiClient.util.js";
import { loadServiceRouteInventory, type ServiceRoute } from "../src/routeInventory.util.js";
import { isErrorShape, isListEnvelope, writeSmokeReport, type RouteObservation } from "../src/smokeReport.util.js";

const selfDestructiveRoutes = [
  "POST /api/v1/auth/logout", "DELETE /api/v1/auth/sessions", "POST /api/v1/auth/password/change", "POST /api/v1/users/me/deactivate", "POST /api/v1/users/me/deletion-request",
  "PATCH /api/v1/users/me/username", "POST /api/v1/admin/auth/logout", "PUT /api/v1/users/me/acting-profile",
];
const inventory = loadServiceRouteInventory();
const publicRoutes = inventory.filter((route) => route.reachability === "public");
const observations: RouteObservation[] = [];

function routeKey(route: ServiceRoute): string {
  return `${route.method} ${route.path}`;
}

function judge(route: ServiceRoute, actor: string, response: ApiResponse): RouteObservation {
  const isAdminRoute = route.path.startsWith("/api/v1/admin/") && !route.path.startsWith("/api/v1/admin/auth/");
  const reasons: string[] = [];
  if (response.status >= 500) reasons.push("server error");
  if (response.status >= 400 && response.status !== 405 && !isErrorShape(response.body)) reasons.push("error body is not {message, code}");
  if (actor === "guest" && route.gatewayRoute?.authentication === "required" && response.status !== 401) reasons.push("guest reached an authenticated route");
  if (actor === "guest" && isAdminRoute && response.status !== 401 && response.status !== 403) reasons.push("guest reached an admin route");
  if (actor === "user" && isAdminRoute && response.status !== 401 && response.status !== 403) reasons.push("customer token reached an admin route");
  if (route.method === "GET" && response.status === 200 && typeof response.body === "object" && response.body !== null && "data" in response.body && Array.isArray(response.body.data) && !isListEnvelope(response.body)) reasons.push("list without nextCursor");
  return { route: `${route.service} ${routeKey(route)}`, actor, status: response.status, verdict: reasons.length === 0 ? "pass" : "fail", ...(reasons.length > 0 ? { reason: reasons.join("; ") } : {}) };
}

describe("route inventory", () => {
  it("routes every public service endpoint to its owning service through the gateway", () => {
    const unreachable = inventory.filter((route) => route.reachability === "unrouted" || route.reachability === "misrouted").map((route) => `${route.reachability} ${route.service} ${routeKey(route)}`);
    writeSmokeReport("routeInventory", inventory.map(({ gatewayRoute, ...route }) => ({ ...route, gatewayAuthentication: gatewayRoute?.authentication ?? null, upstream: gatewayRoute?.upstream ?? null })));
    expect(unreachable).toEqual([]);
  });

  it("never exposes internal routes through the gateway", async () => {
    const internal = inventory.filter((route) => route.reachability === "internal");
    for (const route of internal.slice(0, 40)) {
      const response = await callApi(route.method, route.samplePath, { body: route.method === "GET" ? undefined : {} });
      expect(response.status, `${routeKey(route)} must be hidden`).toBe(404);
    }
  });
});

describe("route sweep through the gateway", () => {
  let user: UserActor;
  let staff: StaffActor;

  beforeAll(async () => {
    user = await registerUser("sweeper");
    staff = await createSuperadmin();
  });

  it("answers every public route as a guest with the right auth behaviour and error shape", async () => {
    for (const route of publicRoutes) {
      const response = await callApi(route.method, route.samplePath, { body: route.method === "GET" || route.method === "DELETE" ? undefined : {} });
      observations.push(judge(route, "guest", response));
    }
    writeSmokeReport("routeSweepGuest", observations.filter((observation) => observation.actor === "guest"));
    expect(observations.filter((observation) => observation.actor === "guest" && observation.verdict === "fail")).toEqual([]);
  });

  it("answers every public route as a signed-in customer without server errors and refuses admin routes", async () => {
    for (const route of publicRoutes.filter((candidate) => !selfDestructiveRoutes.includes(routeKey(candidate)))) {
      const response = await callApi(route.method, route.samplePath, { token: user.accessToken, body: route.method === "GET" || route.method === "DELETE" ? undefined : {} });
      observations.push(judge(route, "user", response));
    }
    writeSmokeReport("routeSweepUser", observations.filter((observation) => observation.actor === "user"));
    expect(observations.filter((observation) => observation.actor === "user" && observation.verdict === "fail")).toEqual([]);
  });

  it("serves every admin read route to a superadmin without server errors", async () => {
    for (const route of publicRoutes.filter((candidate) => candidate.method === "GET" && candidate.path.startsWith("/api/v1/admin/"))) {
      const response = await callApi("GET", route.samplePath, { token: staff.accessToken });
      observations.push(judge(route, "staff", response));
    }
    writeSmokeReport("routeSweepStaff", observations.filter((observation) => observation.actor === "staff"));
    expect(observations.filter((observation) => observation.actor === "staff" && observation.verdict === "fail")).toEqual([]);
  });
});
