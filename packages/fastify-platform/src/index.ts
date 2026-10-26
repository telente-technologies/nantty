import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { metrics } from "@opentelemetry/api";

export interface PlatformPrincipal {
  readonly subject: string;
  readonly permissions: readonly string[];
}

export interface OpenApiDocumentOptions {
  readonly title: string;
  readonly version: string;
  readonly routes: readonly { readonly method: string; readonly path: string; readonly summary: string; readonly tags?: readonly string[] }[];
}

export type BoundarySchema = Readonly<Record<string, unknown>>;

declare module "fastify" {
  interface FastifyRequest { principal: PlatformPrincipal | null }
}

export interface PlatformOptions {
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly bodyLimit?: number;
  readonly trustProxy?: boolean | number;
  readonly logger?: FastifyServerOptions["logger"];
  readonly rateLimit?: false | { readonly max: number; readonly timeWindow: number };
}

export async function createPlatform(options: PlatformOptions): Promise<FastifyInstance> {
  const methodsByPath = new Map<string, Set<string>>();
  const app = Fastify({
    logger: options.logger ?? { level: process.env["LOG_LEVEL"] ?? "info" },
    bodyLimit: options.bodyLimit ?? 256 * 1024,
    trustProxy: options.trustProxy ?? false,
    genReqId: (request) => request.headers["x-request-id"]?.toString() || crypto.randomUUID(),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    disableRequestLogging: true,
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, options.rateLimit === false ? { global: false } : { global: false, ...options.rateLimit });
  app.decorateRequest("principal", null);

  app.addHook("onRoute", (route) => {
    const methods = methodsByPath.get(route.url) ?? new Set<string>();
    for (const method of Array.isArray(route.method) ? route.method : [route.method]) methods.add(method);
    methodsByPath.set(route.url, methods);
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => done(null, body));

  const duration = metrics.getMeter("zudomart.http").createHistogram("http.server.request.duration", { unit: "s", description: "Duration of HTTP server requests." });
  app.decorateRequest("startTime", null);
  app.addHook("onRequest", async (request) => { (request as typeof request & { startTime?: bigint }).startTime = process.hrtime.bigint(); });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = (request as typeof request & { startTime?: bigint }).startTime;
    if (startedAt === undefined) return;
    duration.record(Number(process.hrtime.bigint() - startedAt) / 1_000_000_000, {
      "http.request.method": request.method,
      "http.route": request.routeOptions.url ?? "unmatched",
      "http.response.status_code": reply.statusCode,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    const methods = methodsByPath.get(request.url.split("?", 1)[0] ?? "");
    if (methods !== undefined) {
      const allowed = new Set(methods);
      if (allowed.has("GET")) allowed.add("HEAD");
      allowed.add("OPTIONS");
      if (request.method === "OPTIONS") return reply.header("allow", [...allowed].join(", ")).code(204).send();
      return reply.code(405).send({ message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
    }
    return reply.code(404).send({ message: "Not found.", code: "NOT_FOUND" });
  });
  app.setErrorHandler((error, _request, reply) => {
    if ((error as Error & { statusCode?: number }).statusCode === 413) return reply.code(413).send({ message: "Payload too large.", code: "PAYLOAD_TOO_LARGE" });
    app.log.error({ err: error }, "unhandled request error");
    return reply.code(500).send({ message: "Internal Server Error", code: "INTERNAL_ERROR" });
  });
  app.addHook("onReady", async () => { app.log.info({ service: options.name }, "HTTP platform ready"); });
  app.addHook("onClose", async () => { app.log.info({ service: options.name }, "HTTP platform closed"); });
  app.decorate("platformAddress", () => app.server.address());
  return app;
}

export function requirePrincipal(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply): boolean {
  if (request.principal !== null) return true;
  void reply.code(401).send({ message: "Authentication required.", code: "UNAUTHENTICATED" });
  return false;
}

export function requirePermission(permission: string) {
  return async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply): Promise<void> => {
    if (!requirePrincipal(request, reply)) return;
    if (!request.principal?.permissions.includes(permission)) void reply.code(403).send({ message: "Permission denied.", code: "FORBIDDEN" });
  };
}

export async function checkReadiness(probes: Readonly<Record<string, () => Promise<unknown>>>): Promise<boolean> {
  const results = await Promise.allSettled(Object.values(probes).map((probe) => probe()));
  return results.every((result) => result.status === "fulfilled");
}

export function createOpenApiDocument(options: OpenApiDocumentOptions) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of options.routes) {
    const path = paths[route.path] ?? (paths[route.path] = {});
    path[route.method.toLowerCase()] = { summary: route.summary, ...(route.tags === undefined ? {} : { tags: route.tags }), responses: { "200": { description: "Successful response" } } };
  }
  return { openapi: "3.1.0", info: { title: options.title, version: options.version }, paths } as const;
}

export function boundarySchema<T extends BoundarySchema>(schema: T): T {
  return schema;
}

export function sendLegacyResponse(reply: import("fastify").FastifyReply, response: { readonly status: number; readonly body: unknown; readonly headers: Readonly<Record<string, string | readonly string[] | undefined>> }): void {
  for (const [name, value] of Object.entries(response.headers)) if (value !== undefined) reply.header(name, value);
  if (response.body === undefined || response.status === 204) void reply.code(response.status).send();
  else void reply.code(response.status).send(response.body);
}
