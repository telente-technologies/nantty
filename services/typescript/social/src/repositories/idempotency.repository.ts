import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";
import { isUniqueConstraintViolationError } from "../utils/prismaError.util.js";

export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

export const idempotencyRepository = {
  async find(db: Db, accountId: string, key: string, requestPath: string): Promise<StoredResponse | "pathMismatch" | undefined> {
    const row = await db.idempotencyRecord.findUnique({ where: { accountId_key: { accountId, key } } });
    if (row === null) return undefined;
    if (row.requestPath !== requestPath) return "pathMismatch";
    return { status: row.responseStatus, body: row.responseBody };
  },

  async store(db: Db, accountId: string, key: string, requestPath: string, response: StoredResponse): Promise<void> {
    try {
      await db.idempotencyRecord.create({
        data: { accountId, key, requestPath, responseStatus: response.status, responseBody: (response.body ?? null) as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (!isUniqueConstraintViolationError(error)) throw error;
    }
  },
};
