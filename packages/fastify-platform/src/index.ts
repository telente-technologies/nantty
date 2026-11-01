import Fastify, { type FastifyInstance, type FastifyServerOptions, type HTTPMethods } from "fastify";
import { STATUS_CODES } from "node:http";
import { createRequestContext } from "./httpContracts.js";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { metrics } from "@opentelemetry/api";

export * from "./httpContracts.js";

export interface NodeHttpAdapterOptions {
  readonly host: string;
  readonly port: number;
  readonly maxBodySize: number;
  readonly trustProxy?: boolean;
}

export function createNodeHttpAdapter(options: NodeHttpAdapterOptions): NodeHttpAdapterOptions { return options; }

export interface HttpServer {
  readonly address: { readonly port: number } | undefined;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createHttpServer(options: {
  readonly adapter: NodeHttpAdapterOptions;
  readonly handler: (request: import("./httpContracts.js").HttpRequestContext) => Promise<import("./httpContracts.js").HttpResponseContext>;
}): HttpServer {
  let server: FastifyInstance | undefined;
  let address: { readonly port: number } | undefined;
  return {
    get address() { return address; },
    async start() {
      if (server !== undefined) return;
      const app = Fastify({ logger: false, bodyLimit: options.adapter.maxBodySize, trustProxy: options.adapter.trustProxy ?? false });
      // Preserve raw bytes for proxying and signature verification in existing consumers.
      app.removeAllContentTypeParsers();
      app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
      app.setErrorHandler((error, _request, reply) => {
        const status = (error as { statusCode?: number }).statusCode;
        return reply.code(status === 413 ? 413 : 500).send(status === 413
          ? { message: "Payload too large.", code: "PAYLOAD_TOO_LARGE" }
          : { message: "Internal Server Error", code: "INTERNAL_ERROR" });
      });
      app.setNotFoundHandler(async (request, reply) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        request.raw.once("aborted", abort);
        try {
          const result = await options.handler(createRequestContext({
            id: request.headers["x-request-id"]?.toString() ?? request.id,
            method: request.method, url: request.url,
            headers: Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : String(value)]])),
            body: request.body ?? Buffer.alloc(0), remoteAddress: request.ip, protocol: request.protocol, hostname: request.hostname, signal: controller.signal,
          }));
          sendLegacyResponse(reply, result);
        } finally { request.raw.off("aborted", abort); }
      });
      try { await app.listen({ port: options.adapter.port, host: options.adapter.host }); }
      catch (error) { await app.close(); throw error; }
      server = app;
      const bound = app.server.address();
      address = typeof bound === "object" && bound !== null ? { port: bound.port } : { port: options.adapter.port };
    },
    async stop() {
      if (server === undefined) return;
      const current = server;
      server = undefined;
      address = undefined;
      await current.close();
    },
  };
}

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
  readonly trustProxy?: NonNullable<FastifyServerOptions["trustProxy"]> | number;
  readonly logger?: FastifyServerOptions["logger"];
  readonly rateLimit?: false | { readonly max: number; readonly timeWindow: number };
}

export async function createPlatform(options: PlatformOptions): Promise<FastifyInstance> {
  const methodsByPath = new Map<string, Set<string>>();
  const trustedProxyHops = options.trustProxy;
  const trustProxy = typeof trustedProxyHops === "number"
    ? (_address: string, hop: number) => hop < trustedProxyHops
    : trustedProxyHops ?? false;
  const serverOptions: FastifyServerOptions = {
    logger: options.logger ?? { level: process.env["LOG_LEVEL"] ?? "info" },
    bodyLimit: options.bodyLimit ?? 256 * 1024,
    trustProxy,
    genReqId: (request) => request.headers["x-request-id"]?.toString() || crypto.randomUUID(),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    disableRequestLogging: true,
  };
  const app = Fastify<import("node:http").Server>(serverOptions);

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

  const duration = metrics.getMeter("nantty.http").createHistogram("http.server.request.duration", { unit: "s", description: "Duration of HTTP server requests." });
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
    const path = request.url.split("?", 1)[0] ?? "";
    const methods = [...new Set([...methodsByPath.values()].flatMap((value) => [...value]))]
      .filter((method) => app.findRoute({ method: method as HTTPMethods, url: path }) !== null);
    if (methods.length > 0) {
      const allowed = new Set(methods);
      if (allowed.has("GET")) allowed.add("HEAD");
      allowed.add("OPTIONS");
      if (request.method === "OPTIONS") return reply.header("allow", [...allowed].join(", ")).code(204).send();
      return reply.header("allow", [...allowed].join(", ")).code(405).send({ message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
    }
    return reply.code(404).send({ message: "Not found.", code: "NOT_FOUND" });
  });
  app.setErrorHandler((error, _request, reply) => {
    const { statusCode, code } = error as Error & { statusCode?: number; code?: string };
    if (statusCode === 413) return reply.code(413).send({ message: "Payload too large.", code: "PAYLOAD_TOO_LARGE" });
    if (typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
      const safeCode = typeof code === "string" && /^FST_ERR_[A-Z0-9_]{1,80}$/.test(code) ? code : `HTTP_${statusCode}`;
      return reply.code(statusCode).send({ message: STATUS_CODES[statusCode] ?? "Request rejected.", code: safeCode });
    }
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
  else void reply.code(response.status).send(response.body instanceof Uint8Array ? Buffer.from(response.body) : response.body);
}
