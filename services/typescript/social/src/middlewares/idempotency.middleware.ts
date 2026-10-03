import { conflict } from "../errors/social.error.js";
import { idempotencyRepository, type StoredResponse } from "../repositories/idempotency.repository.js";
import type { SocialDatabase } from "../databases/prisma.database.js";

export interface IdempotencyOutcome extends StoredResponse {
  readonly replayed: boolean;
}

export interface IdempotencyGuard {
  run(accountId: string, key: string, requestPath: string, execute: () => Promise<StoredResponse>): Promise<IdempotencyOutcome>;
}

export function createIdempotencyGuard(database: SocialDatabase): IdempotencyGuard {
  return {
    async run(accountId, key, requestPath, execute) {
      const existing = await idempotencyRepository.find(database.client, accountId, key, requestPath);
      if (existing === "pathMismatch") throw conflict("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used for a different request.");
      if (existing !== undefined) return { ...existing, replayed: true };
      const result = await execute();
      if (result.status < 500) await idempotencyRepository.store(database.client, accountId, key, requestPath, result);
      return { ...result, replayed: false };
    },
  };
}
