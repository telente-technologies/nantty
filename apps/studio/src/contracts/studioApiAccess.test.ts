import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { findStudioApiRoute, studioApiRoutes } from "@/config/studioApiAccess.config";
import { ApiError } from "@/errors/api.error";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";

type GatewayResolver = (method: string, path: string) => { readonly upstream: string; readonly authentication: string } | undefined;

const studioSourceRoot = resolve(__dirname, "..");
const gatewayRoutesFile = resolve(studioSourceRoot, "../../../services/typescript/gateway/src/routes/upstream.routes.ts");
const concretePath = (template: string) => template.replace(/:[A-Za-z]+/g, "sample_1");

async function loadGatewayResolver(): Promise<GatewayResolver> {
  const gatewayModule = (await import(pathToFileURL(gatewayRoutesFile).href)) as { resolveUpstreamRouteForRequest: GatewayResolver };
  return gatewayModule.resolveUpstreamRouteForRequest;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return ["mocks", "contracts", "server", "bff"].includes(entry) ? [] : listSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function collectCalledApiPaths(): { readonly file: string; readonly path: string }[] {
  const literalPattern = /["`](\/api\/v1\/[^"`\s?]*)["`?]/g;
  return listSourceFiles(studioSourceRoot)
    .filter((file) => !file.endsWith("studioApiAccess.config.ts"))
    .flatMap((file) => [...readFileSync(file, "utf8").matchAll(literalPattern)].map((match) => ({ file, path: match[1]!.replace(/\$\{[^}]+\}/g, "sample_1") })));
}

describe("studio BFF allow-list", () => {
  it("routes every allowed call to a gateway upstream", async () => {
    const resolveRoute = await loadGatewayResolver();
    for (const route of studioApiRoutes) {
      const upstream = resolveRoute(route.method, concretePath(route.path));
      assert.ok(upstream, `${route.method} ${route.path} has no gateway route`);
      if (route.isPublic) assert.equal(upstream.authentication, "optional", `${route.path} is public in Studio but needs auth at the gateway`);
    }
  });

  it("covers every API path the studio UI calls", () => {
    const called = collectCalledApiPaths();
    assert.ok(called.length > 30, "expected to find the studio service calls");
    for (const call of called) {
      const allowed = ["GET", "POST", "PUT", "PATCH", "DELETE"].some((method) => findStudioApiRoute(method, call.path));
      assert.ok(allowed, `${call.path} (in ${call.file.slice(studioSourceRoot.length)}) is not on the studio allow-list`);
    }
  });

  it("has a mock for every allowed call so mock mode never 404s", async () => {
    for (const route of studioApiRoutes) {
      try {
        await dispatchMockApiRequest(route.method, concretePath(route.path), new URLSearchParams("period=month&board=streamer&currency=NGN"), null);
      } catch (error) {
        assert.ok(!(error instanceof ApiError && error.code === "MOCK_ROUTE_NOT_FOUND"), `${route.method} ${route.path} has no mock`);
      }
    }
  });

  it("denies calls Studio has no business making", () => {
    for (const [method, path] of [["GET", "/api/v1/orders"], ["POST", "/api/v1/wallets/me/withdrawals"], ["GET", "/api/v1/admin/users"], ["DELETE", "/api/v1/lives/live_1"], ["GET", "/api/v1/conversations"], ["POST", "/api/v1/creators/earnings/convert"]] as const) {
      assert.equal(findStudioApiRoute(method, path), null, `${method} ${path} should be denied`);
    }
    assert.equal(findStudioApiRoute("GET", "/api/v1/lives/live_1/stream-key/extra"), null);
    assert.equal(findStudioApiRoute("GET", "/api/v1/lives//stream-key"), null);
  });
});
