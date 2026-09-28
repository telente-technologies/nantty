import { createHash } from "node:crypto";

import { BadRequestError, ConflictError, UnprocessableEntityError } from "@zudojs/errors";
import { createResponseContext, type HttpMiddleware } from "@zudojs/http";

import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_TTL_SECONDS } from "../constants/security.constant.js";
import type { Clock, Principal } from "../interfaces/index.js";
import type { IdempotencyStore } from "../repositories/idempotency.repository.js";
import { readRawRequestBody } from "./verifyWebhookSignature.middleware.js";

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function createIdempotencyKeyMiddleware(store: IdempotencyStore, clock: Clock): HttpMiddleware {
  return async (context, next) => {
    const key = context.request.getHeader(IDEMPOTENCY_KEY_HEADER)?.trim() ?? "";
    if (!KEY_PATTERN.test(key)) {
      throw new BadRequestError("An Idempotency-Key header (8-128 letters, digits, - or _) is required.");
    }
    const principal = context.state.get<Principal>("principal");
    const scope = `${principal?.userId ?? "anonymous"}:${context.request.method}:${context.request.path}`;
    const requestHash = createHash("sha256").update(readRawRequestBody(context.request.body)).digest("hex");
    const now = clock.now();
    const claim = await store.claim(scope, key, requestHash, new Date(now.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000), now);
    if (claim.state === "mismatch") {
      throw new UnprocessableEntityError("This Idempotency-Key was already used with a different request.");
    }
    if (claim.state === "in_progress") throw new ConflictError("A request with this Idempotency-Key is still in progress.");
    if (claim.state === "replay" && claim.response !== undefined) {
      return createResponseContext({
        status: claim.response.status,
        headers: { "content-type": "application/json", "idempotent-replayed": "true" },
        body: claim.response.body,
      });
    }
    try {
      const response = await next();
      if (response.status >= 500) {
        await store.release(scope, key);
      } else {
        await store.complete(scope, key, { status: response.status, body: typeof response.body === "string" ? response.body : "" });
      }
      return response;
    } catch (error) {
      await store.release(scope, key);
      throw error;
    }
  };
}
