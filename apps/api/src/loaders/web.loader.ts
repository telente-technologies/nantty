import type { HttpMiddleware } from "@zudojs/http";

import type { AppSettings } from "../configs/settings.config.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { Persistence } from "../interfaces/persistence.interface.js";
import type { AccessTokenVerifier } from "../interfaces/principal.interface.js";
import { createRouteGuard, type RouteGuard } from "../middlewares/authorize.middleware.js";
import { createIdempotencyKeyMiddleware } from "../middlewares/idempotency.middleware.js";
import { createSensitiveEndpointRateLimit } from "../middlewares/rateLimitSensitive.middleware.js";
import { InMemoryIdempotencyStore, PrismaIdempotencyStore } from "../repositories/idempotency.repository.js";

export interface WebKit {
  readonly guard: RouteGuard;
  readonly requireIdempotencyKey: HttpMiddleware;
  readonly limitSensitiveRequests: HttpMiddleware;
}

export function createWebKit(
  settings: AppSettings,
  persistence: Persistence,
  clock: Clock,
  accessTokens: AccessTokenVerifier,
): WebKit {
  const idempotencyStore = persistence === "prisma" ? new PrismaIdempotencyStore() : new InMemoryIdempotencyStore();
  return {
    guard: createRouteGuard(accessTokens),
    requireIdempotencyKey: createIdempotencyKeyMiddleware(idempotencyStore, clock),
    limitSensitiveRequests: createSensitiveEndpointRateLimit(settings.auth.sensitiveRateLimit),
  };
}
