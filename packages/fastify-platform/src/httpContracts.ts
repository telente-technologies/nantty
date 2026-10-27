import { z } from "zod";

export type HttpMethod = string;
export type RequestHeaders = Readonly<Record<string, string>>;
export type RequestQuery = Readonly<Record<string, string | readonly string[] | undefined>>;
export type RequestParams = Readonly<Record<string, string | undefined>>;

export interface RequestContextInit {
  readonly id?: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly path?: string;
  readonly headers?: RequestHeaders;
  readonly query?: RequestQuery;
  readonly params?: RequestParams;
  readonly body?: unknown;
  readonly remoteAddress?: string;
  readonly protocol?: string;
  readonly hostname?: string;
  readonly signal?: AbortSignal;
}

/** Framework-neutral request data used by Fastify adapters and domain handlers. */
export class HttpRequestContext {
  readonly id: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly path: string;
  readonly headers: RequestHeaders;
  readonly query: RequestQuery;
  readonly params: RequestParams;
  readonly body: unknown;
  readonly remoteAddress: string | undefined;
  readonly protocol: string | undefined;
  readonly hostname: string | undefined;
  readonly signal: AbortSignal | undefined;

  constructor(init: RequestContextInit) {
    this.id = init.id ?? crypto.randomUUID();
    this.method = init.method;
    this.url = init.url;
    this.path = init.path ?? new URL(init.url, "http://nantty.invalid").pathname;
    this.headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
    this.query = init.query ?? {};
    this.params = init.params ?? {};
    this.body = init.body;
    this.remoteAddress = init.remoteAddress;
    this.protocol = init.protocol;
    this.hostname = init.hostname;
    this.signal = init.signal;
  }

  getHeader(name: string): string | undefined { return this.headers[name.toLowerCase()]; }
  getQuery(name: string): string | readonly string[] | undefined { return this.query[name]; }
  getParam(name: string): string | undefined { return this.params[name]; }
}

export function createRequestContext(init: RequestContextInit): HttpRequestContext { return new HttpRequestContext(init); }

export type ResponseHeaders = Record<string, string | readonly string[] | undefined>;
export interface ResponseContextInit { readonly status?: number; readonly headers?: ResponseHeaders; readonly body?: unknown }

/** Mutable response envelope. It is deliberately small because Fastify owns actual I/O. */
export class HttpResponseContext {
  private responseStatus: number;
  private responseHeaders: ResponseHeaders;
  private responseBody: unknown;

  constructor(init: ResponseContextInit = {}) {
    this.responseStatus = init.status ?? 200;
    this.responseHeaders = { ...(init.headers ?? {}) };
    this.responseBody = init.body;
  }

  get status(): number { return this.responseStatus; }
  get headers(): ResponseHeaders { return this.responseHeaders; }
  get body(): unknown { return this.responseBody; }
  setHeader(name: string, value: string | readonly string[]): this { this.responseHeaders[name.toLowerCase()] = value; return this; }
  removeHeader(name: string): this { delete this.responseHeaders[name.toLowerCase()]; return this; }
  setStatus(status: number): this { this.responseStatus = status; return this; }
  setBody(body: unknown): this { this.responseBody = body; return this; }
  json(body: unknown): this { this.setHeader("content-type", "application/json; charset=utf-8"); return this.setBody(body); }
  text(body: string): this { this.setHeader("content-type", "text/plain; charset=utf-8"); return this.setBody(body); }
  clone(): HttpResponseContext { return new HttpResponseContext({ status: this.responseStatus, headers: { ...this.responseHeaders }, body: this.responseBody }); }
}

export function createResponseContext(init: ResponseContextInit = {}): HttpResponseContext { return new HttpResponseContext(init); }

export interface HttpMiddlewareContext { readonly request: HttpRequestContext; readonly signal?: AbortSignal; readonly state?: Map<unknown, unknown> }
export type HttpMiddleware = (context: HttpMiddlewareContext, next: () => Promise<HttpResponseContext>) => Promise<HttpResponseContext> | HttpResponseContext;

/** Runs framework-neutral policies around a Fastify request without embedding a second web server. */
export class HttpMiddlewarePipeline {
  private readonly middlewares: readonly HttpMiddleware[];
  constructor(options: { readonly middlewares?: readonly HttpMiddleware[] } = {}) { this.middlewares = options.middlewares ?? []; }
  async execute(request: HttpRequestContext, response: HttpResponseContext, options: { readonly signal?: AbortSignal } = {}): Promise<HttpResponseContext> {
    const dispatch = async (index: number): Promise<HttpResponseContext> => {
      const middleware = this.middlewares[index];
      if (middleware === undefined) return response;
      return middleware({ request, signal: options.signal, state: new Map() }, () => dispatch(index + 1));
    };
    return dispatch(0);
  }
}

export interface HttpRouterContext {
  readonly request: HttpRequestContext;
  readonly params: RequestParams;
  readonly query: RequestQuery;
  readonly route?: unknown;
  readonly middleware?: unknown;
  readonly signal?: AbortSignal;
  readonly state: Map<unknown, unknown>;
}
export interface HttpRouter { get(path: string, handler: unknown): unknown; post(path: string, handler: unknown): unknown; delete(path: string, handler: unknown): unknown; }
export interface RouteDispatchResult { readonly response: HttpResponseContext; readonly route?: { readonly path: string } }
export function createRouter(): HttpRouter & { dispatch(request: HttpRequestContext, options?: { readonly signal?: AbortSignal }): Promise<RouteDispatchResult> } {
  const unsupported = () => { throw new Error("Route registration belongs to the Fastify adapter."); };
  return { get: unsupported, post: unsupported, delete: unsupported, dispatch: async () => ({ response: createResponseContext({ status: 404 }).json({ message: "Not found.", code: "NOT_FOUND" }) }) };
}

export const schema = z;
export type Schema<T> = z.ZodType<T>;
export type Infer<T extends z.ZodType> = z.infer<T>;
export interface SchemaIssue { readonly code: string; readonly path: readonly (string | number | symbol)[]; readonly message: string }

export interface Logger {
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, attributes?: Record<string, unknown>): void;
  debug(message: string, attributes?: Record<string, unknown>): void;
}

export function createLogger(options: { readonly name: string; readonly level?: string }): Logger {
  const write = (level: "debug" | "info" | "warn" | "error", message: string, attributes?: Record<string, unknown>) => {
    const entry = JSON.stringify({ level, service: options.name, message, ...(attributes === undefined ? {} : attributes), timestamp: new Date().toISOString() });
    if (level === "error") console.error(entry); else if (level === "warn") console.warn(entry); else console.log(entry);
  };
  return { info: (message, attributes) => write("info", message, attributes), warn: (message, attributes) => write("warn", message, attributes), error: (message, attributes) => write("error", message, attributes), debug: (message, attributes) => write("debug", message, attributes) };
}
