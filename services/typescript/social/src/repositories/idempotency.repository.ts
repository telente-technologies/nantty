import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";
import { isUniqueConstraintViolationError } from "../utils/prismaError.util.js";

export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface IdempotencyClaimRequest {
  readonly accountId: string;
  readonly key: string;
  readonly requestPath: string;
  readonly requestHash: string;
  readonly now: Date;
  readonly lockedUntil: Date;
}

export type IdempotencyClaim =
  | { readonly state: "claimed" }
  | { readonly state: "inFlight" }
  | { readonly state: "mismatch" }
  | { readonly state: "replay"; readonly response: StoredResponse };

export interface IdempotencyStore {
  claim(request: IdempotencyClaimRequest): Promise<IdempotencyClaim>;
  complete(accountId: string, key: string, response: StoredResponse): Promise<void>;
  release(accountId: string, key: string): Promise<void>;
}

interface RecordSnapshot {
  readonly requestPath: string;
  readonly requestHash: string;
  readonly completedAt: Date | null;
  readonly lockedUntil: Date | null;
  readonly responseStatus: number | null;
  readonly responseBody: unknown;
}

export function decideIdempotencyClaim(record: RecordSnapshot, request: IdempotencyClaimRequest): IdempotencyClaim | "takeOver" {
  if (record.requestPath !== request.requestPath || (record.requestHash !== "" && record.requestHash !== request.requestHash)) return { state: "mismatch" };
  if (record.completedAt !== null && record.responseStatus !== null) return { state: "replay", response: { status: record.responseStatus, body: record.responseBody } };
  if (record.lockedUntil !== null && record.lockedUntil <= request.now) return "takeOver";
  return { state: "inFlight" };
}

export function createPrismaIdempotencyStore(db: Db): IdempotencyStore {
  return {
    async claim(request) {
      const where = { accountId_key: { accountId: request.accountId, key: request.key } };
      try {
        await db.idempotencyRecord.create({ data: { accountId: request.accountId, key: request.key, requestPath: request.requestPath, requestHash: request.requestHash, lockedUntil: request.lockedUntil } });
        return { state: "claimed" };
      } catch (error) {
        if (!isUniqueConstraintViolationError(error)) throw error;
      }
      const row = await db.idempotencyRecord.findUnique({ where });
      if (row === null) return { state: "inFlight" };
      const decision = decideIdempotencyClaim(row, request);
      if (decision !== "takeOver") return decision;
      const taken = await db.idempotencyRecord.updateMany({ where: { accountId: request.accountId, key: request.key, completedAt: null, lockedUntil: row.lockedUntil }, data: { lockedUntil: request.lockedUntil } });
      return taken.count === 1 ? { state: "claimed" } : { state: "inFlight" };
    },
    async complete(accountId, key, response) {
      await db.idempotencyRecord.updateMany({ where: { accountId, key }, data: { responseStatus: response.status, responseBody: (response.body ?? null) as Prisma.InputJsonValue, completedAt: new Date(), lockedUntil: null } });
    },
    async release(accountId, key) {
      await db.idempotencyRecord.deleteMany({ where: { accountId, key, completedAt: null } });
    },
  };
}
