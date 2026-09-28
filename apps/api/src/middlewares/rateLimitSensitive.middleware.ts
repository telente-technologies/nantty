import { createRateLimitMiddleware, type HttpMiddleware } from "@zudojs/http";

export interface SensitiveRateLimit {
  readonly windowMs: number;
  readonly max: number;
}

export function createSensitiveEndpointRateLimit(options: SensitiveRateLimit): HttpMiddleware {
  if (options.max === 0) return async (_context, next) => next();
  return createRateLimitMiddleware({
    windowMs: options.windowMs,
    max: options.max,
    message: "Too many attempts. Try again later.",
  });
}
