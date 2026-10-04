import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { resolveUpstreamRouteForRequest, type UpstreamRoute } from "../../../typescript/gateway/src/routes/upstream.routes.js";
import { isInternalOnlyPath } from "../../../typescript/gateway/src/services/internalRouteGuard.service.js";

export interface ServiceRoute {
  readonly service: string;
  readonly method: string;
  readonly path: string;
  readonly file: string;
  readonly samplePath: string;
  readonly gatewayRoute: UpstreamRoute | undefined;
  readonly reachability: "public" | "internal" | "unrouted" | "misrouted" | "nonApi";
}

const servicesRoot = resolve(import.meta.dirname, "../../..");
const owningUpstream: Record<string, string> = {
  auth: "identity", users: "identity", currency: "identity", admin: "identity", catalog: "commerce", inventory: "commerce", orders: "commerce", payments: "money",
  wallet: "money", ledger: "money", escrow: "money", subscriptions: "money", creators: "money", live: "live", ads: "ads", moderation: "trust",
  social: "social", media: "media", search: "search", notifications: "notifications", gateway: "gateway",
};
export const intentionallySharedRoutes: readonly string[] = ["go:moderation POST /api/v1/reports", "go:users GET /api/v1/admin/legal/", "go:users PUT /api/v1/admin/legal/", "go:users POST /api/v1/admin/legal/"];

function listSourceFiles(directory: string, extension: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "generated") continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...listSourceFiles(path, extension));
    else if (path.endsWith(extension) && !path.endsWith("_test.go") && !path.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

function substituteGoBasePaths(source: string): string {
  let result = source;
  for (const match of source.matchAll(/(\w+)\s*:?=\s*"(\/api[^"]*)"/g)) {
    const [, name, value] = match as unknown as [string, string, string];
    result = result.replace(new RegExp(`"(GET|POST|PUT|PATCH|DELETE) "\\s*\\+\\s*${name}\\s*\\+\\s*"`, "g"), `"$1 ${value}`);
    result = result.replace(new RegExp(`"(GET|POST|PUT|PATCH|DELETE) "\\s*\\+\\s*${name}\\b(?!\\s*\\+)`, "g"), `"$1 ${value}"`);
  }
  return result;
}

function substituteTypeScriptBasePaths(source: string): string {
  let result = source;
  for (const match of source.matchAll(/const (\w+)\s*=\s*"(\/api[^"]*)"/g)) {
    const [, name, value] = match as unknown as [string, string, string];
    result = result.replaceAll(`\${${name}}`, value).replace(new RegExp(`router\\.(get|post|put|patch|delete)\\(\\s*${name}\\s*,`, "g"), `router.$1("${value}",`);
  }
  return result;
}

function collectRawRoutes(): Array<{ service: string; method: string; path: string; file: string }> {
  const routes: Array<{ service: string; method: string; path: string; file: string }> = [];
  for (const file of listSourceFiles(join(servicesRoot, "go/modules"), ".go")) {
    const module = relative(join(servicesRoot, "go/modules"), file).split("/")[0] ?? "";
    for (const match of substituteGoBasePaths(readFileSync(file, "utf8")).matchAll(/"(GET|POST|PUT|PATCH|DELETE) (\/[^"\s]*)"/g)) routes.push({ service: `go:${module}`, method: match[1] ?? "", path: match[2] ?? "", file: relative(servicesRoot, file) });
  }
  for (const service of ["social", "media", "search", "notifications"]) {
    for (const file of listSourceFiles(join(servicesRoot, "typescript", service, "src"), ".ts")) {
      const source = substituteTypeScriptBasePaths(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*[`"]([^`"]+)[`"]/g)) routes.push({ service: `ts:${service}`, method: (match[1] ?? "").toUpperCase(), path: match[2] ?? "", file: relative(servicesRoot, file) });
      for (const match of source.matchAll(/method:\s*"(GET|POST|PUT|PATCH|DELETE)",\s*path:\s*[`"]([^`"]+)[`"]/g)) routes.push({ service: `ts:${service}`, method: match[1] ?? "", path: match[2] ?? "", file: relative(servicesRoot, file) });
    }
  }
  return routes;
}

export function buildSamplePath(path: string, sampleId: string): string {
  return path.replace(/\{\$\}$/, "").replace(/\{[^}]+\}/g, sampleId).replace(/:[A-Za-z]+/g, sampleId);
}

export function loadServiceRouteInventory(sampleId = "00000000-0000-4000-8000-000000000000"): ServiceRoute[] {
  const seen = new Set<string>();
  const inventory: ServiceRoute[] = [];
  for (const route of collectRawRoutes()) {
    const key = `${route.service} ${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const samplePath = buildSamplePath(route.path, sampleId);
    const gatewayRoute = resolveUpstreamRouteForRequest(route.method, samplePath);
    let reachability: ServiceRoute["reachability"];
    if (!samplePath.startsWith("/api/") && !samplePath.startsWith("/webhooks/")) reachability = "nonApi";
    else if (isInternalOnlyPath(samplePath)) reachability = "internal";
    else if (gatewayRoute === undefined) reachability = "unrouted";
    else if (gatewayRoute.upstream !== owningUpstream[route.service.split(":")[1] ?? ""] && !intentionallySharedRoutes.some((shared) => key.startsWith(shared))) reachability = "misrouted";
    else reachability = "public";
    inventory.push({ ...route, samplePath, gatewayRoute, reachability });
  }
  return inventory;
}
