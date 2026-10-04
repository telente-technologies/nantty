import { timingSafeEqual } from "node:crypto";

import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { json } from "../utils/http.util.js";

export function hasValidInternalToken(context: HttpRouterContext, expected: string): boolean {
  const provided = Buffer.from(context.request.getHeader("x-internal-token") ?? "");
  const wanted = Buffer.from(expected);
  return expected !== "" && provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

export function requireInternalToken(expected: string, handle: (context: HttpRouterContext) => Promise<HttpResponseContext>) {
  return async (context: HttpRouterContext): Promise<HttpResponseContext> => {
    if (!hasValidInternalToken(context, expected)) return json(401, { message: "Invalid internal token.", code: "UNAUTHORIZED" });
    return handle(context);
  };
}
