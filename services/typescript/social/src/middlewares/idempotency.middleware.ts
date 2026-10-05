import { createHash } from "node:crypto";

import { conflict, unprocessable } from "../errors/social.error.js";
import type { IdempotencyStore, StoredResponse } from "../repositories/idempotency.repository.js";

const inFlightLockMilliseconds = 60_000;

export interface IdempotencyOutcome extends StoredResponse {
  readonly replayed: boolean;
}

export interface IdempotentRequest {
  readonly accountId: string;
  readonly key: string;
  readonly method: string;
  readonly requestPath: string;
  readonly body: unknown;
}

export interface IdempotencyGuard {
  run(request: IdempotentRequest, execute: () => Promise<StoredResponse>): Promise<IdempotencyOutcome>;
}

export function hashIdempotentRequest(method: string, requestPath: string, body: unknown): string {
  return createHash("sha256").update(`${method.toUpperCase()} ${requestPath}\n${JSON.stringify(body ?? null)}`).digest("hex");
}

export function createIdempotencyGuard(store: IdempotencyStore, now: () => Date = () => new Date()): IdempotencyGuard {
  return {
    async run(request, execute) {
      const startedAt = now();
      const claim = await store.claim({
        accountId: request.accountId, key: request.key, requestPath: request.requestPath, requestHash: hashIdempotentRequest(request.method, request.requestPath, request.body),
        now: startedAt, lockedUntil: new Date(startedAt.getTime() + inFlightLockMilliseconds),
      });
      if (claim.state === "mismatch") throw unprocessable("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.");
      if (claim.state === "inFlight") throw conflict("IDEMPOTENCY_IN_PROGRESS", "A request with this Idempotency-Key is still in progress.");
      if (claim.state === "replay") return { ...claim.response, replayed: true };
      let result: StoredResponse;
      try {
        result = await execute();
      } catch (error) {
        await store.release(request.accountId, request.key);
        throw error;
      }
      if (result.status >= 500) await store.release(request.accountId, request.key);
      else await store.complete(request.accountId, request.key, result);
      return { ...result, replayed: false };
    },
  };
}

