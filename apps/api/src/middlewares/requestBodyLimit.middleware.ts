import type { HttpMiddleware } from "@zudojs/http";

import { json } from "../utils/http.util.js";

export const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 1024 * 1024;

export interface RouteBodyLimit {
  readonly method: string;
  readonly pathPattern: RegExp;
  readonly maxBytes: number;
}

function measureBodyBytes(body: unknown): number {
  if (body instanceof Uint8Array) return body.byteLength;
  if (typeof body === "string") return Buffer.byteLength(body);
  return 0;
}

export function limitRequestBodySize(defaultMaxBytes: number, routeLimits: readonly RouteBodyLimit[]): HttpMiddleware {
  return async (context, next) => {
    const { method, path } = context.request;
    const routeLimit = routeLimits.find((limit) => limit.method === method.toUpperCase() && limit.pathPattern.test(path));
    const maxBytes = routeLimit?.maxBytes ?? defaultMaxBytes;
    const declaredLength = Number(context.request.getHeader("content-length") ?? 0);
    if (declaredLength > maxBytes || measureBodyBytes(context.request.body) > maxBytes) {
      return json(413, { message: `The request body must be at most ${maxBytes} bytes.`, code: "PAYLOAD_TOO_LARGE" });
    }
    return next();
  };
}
