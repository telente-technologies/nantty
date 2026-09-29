import type { HttpMiddleware } from "@zudojs/http";

import { IDEMPOTENCY_KEY_HEADER } from "../constants/security.constant.js";

export function createOptionalIdempotencyKeyMiddleware(requireIdempotencyKey: HttpMiddleware): HttpMiddleware {
  return async (context, next) => {
    const key = context.request.getHeader(IDEMPOTENCY_KEY_HEADER);
    if (key === undefined || key.trim() === "") return next();
    return requireIdempotencyKey(context, next);
  };
}
