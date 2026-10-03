import { createResponseContext, type HttpMiddleware } from "@zudojs/http";

import type { RateLimitStore } from "../services/rateLimitStore.service.js";

export function createGlobalRateLimitMiddleware(store: RateLimitStore, maxPerMinute: number): HttpMiddleware {
  return async (context, next) => {
    if (maxPerMinute <= 0 || context.request.path === "/healthz") return next();
    const decision = await store.hit(`rl:global:${context.request.remoteAddress ?? "unknown"}`, maxPerMinute, 60);
    if (decision.allowed) return next();
    return createResponseContext({ status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } }).json({ message: "Too many requests. Try again shortly.", code: "RATE_LIMITED" });
  };
}
