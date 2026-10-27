import type { HttpRequestContext, HttpResponseContext } from "@nantty/fastify-platform";

export interface RouteContext {
  readonly request: HttpRequestContext;
  readonly params: Readonly<Record<string, string>>;
}

export type RouteHandler = (context: RouteContext) => Promise<HttpResponseContext>;

export interface RouteDefinition {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly handler: RouteHandler;
}
