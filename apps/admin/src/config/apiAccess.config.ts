import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { adminApiRouteTable, type ApiRouteDefinition } from "@/config/apiRoutes.config";

export type ApiAccessRequirement = { readonly kind: "anyOf"; readonly permissions: readonly AdminPermission[] } | { readonly kind: "superadmin" } | { readonly kind: "ownAccount" };

export interface ResolvedApiRoute {
  readonly method: string;
  readonly path: string;
  readonly requirement: ApiAccessRequirement;
  readonly stepUp: boolean;
  readonly reasonRequired: boolean;
  readonly stepUpWhenBody?: (body: unknown) => boolean;
  readonly singleUseStepUp: boolean;
}

interface CompiledRoute extends ResolvedApiRoute {
  readonly pattern: RegExp;
}

export const minimumReasonLength = 5;

function compilePathPattern(path: string): RegExp {
  const segments = path.split("/").map((segment) => {
    if (segment.startsWith(":")) return "[^/]+";
    const choices = /^\{(.+)\}$/.exec(segment);
    if (choices) return `(?:${choices[1]!.split("|").map(escapeForRegExp).join("|")})`;
    return escapeForRegExp(segment);
  });
  return new RegExp(`^${segments.join("/")}$`);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

function compileRoute(definition: ApiRouteDefinition): CompiledRoute {
  const requirement: ApiAccessRequirement =
    definition.access === "ownAccount" ? { kind: "ownAccount" } : definition.access === "superadmin" ? { kind: "superadmin" } : { kind: "anyOf", permissions: definition.access };
  return {
    method: definition.method,
    path: definition.path,
    requirement,
    stepUp: definition.stepUp ?? false,
    reasonRequired: definition.reason ?? false,
    singleUseStepUp: definition.singleUseStepUp ?? false,
    stepUpWhenBody: definition.stepUpWhenBody,
    pattern: compilePathPattern(definition.path),
  };
}

const compiledRoutes: readonly CompiledRoute[] = adminApiRouteTable.map(compileRoute);

export function listAdminApiRoutes(): readonly ResolvedApiRoute[] {
  return compiledRoutes;
}

export function findAdminApiRoute(method: string, apiPath: string): ResolvedApiRoute | null {
  const normalisedMethod = method === "HEAD" ? "GET" : method;
  return compiledRoutes.find((route) => route.method === normalisedMethod && route.pattern.test(apiPath)) ?? null;
}

export function findApiAccessRequirement(apiPath: string, method = "GET"): ApiAccessRequirement | null {
  return findAdminApiRoute(method, apiPath)?.requirement ?? null;
}

export function doesApiCallRequireStepUp(method: string, apiPath: string, body?: unknown): boolean {
  const route = findAdminApiRoute(method, apiPath);
  if (!route) return false;
  return route.stepUp || (route.stepUpWhenBody?.(body) ?? false);
}

export function readReasonFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const reason = (body as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason.trim() : "";
}

export function isReasonMissing(route: ResolvedApiRoute, body: unknown): boolean {
  return route.reasonRequired && readReasonFromBody(body).length < minimumReasonLength;
}
