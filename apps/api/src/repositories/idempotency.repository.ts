import { isUniqueConstraintViolation } from "../databases/prisma.database.js";
import { prisma } from "../integrations/database.integration.js";

export interface StoredResponse {
  readonly status: number;
  readonly body: string;
}

export interface IdempotencyClaim {
  readonly state: "claimed" | "in_progress" | "replay" | "mismatch";
  readonly response?: StoredResponse;
}

export interface IdempotencyStore {
  claim(scope: string, key: string, requestHash: string, expiresAt: Date, now: Date): Promise<IdempotencyClaim>;
  complete(scope: string, key: string, response: StoredResponse): Promise<void>;
  release(scope: string, key: string): Promise<void>;
}

interface MemoryRecord {
  requestHash: string;
  expiresAt: Date;
  response?: StoredResponse;
}

function decideIdempotencyClaimFromRecord(record: MemoryRecord | undefined, requestHash: string): IdempotencyClaim | undefined {
  if (record === undefined) return undefined;
  if (record.requestHash !== requestHash) return { state: "mismatch" };
  if (record.response === undefined) return { state: "in_progress" };
  return { state: "replay", response: record.response };
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, MemoryRecord>();

  public async claim(scope: string, key: string, requestHash: string, expiresAt: Date, now: Date): Promise<IdempotencyClaim> {
    const id = `${scope}\u0000${key}`;
    const existing = this.records.get(id);
    if (existing !== undefined && existing.expiresAt > now) return decideIdempotencyClaimFromRecord(existing, requestHash) ?? { state: "claimed" };
    this.records.set(id, { requestHash, expiresAt });
    return { state: "claimed" };
  }

  public async complete(scope: string, key: string, response: StoredResponse): Promise<void> {
    const record = this.records.get(`${scope}\u0000${key}`);
    if (record !== undefined) record.response = response;
  }

  public async release(scope: string, key: string): Promise<void> {
    this.records.delete(`${scope}\u0000${key}`);
  }
}

export class PrismaIdempotencyStore implements IdempotencyStore {
  public async claim(scope: string, key: string, requestHash: string, expiresAt: Date, now: Date): Promise<IdempotencyClaim> {
    await prisma().idempotencyRecord.deleteMany({ where: { scope, key, expiresAt: { lte: now } } });
    try {
      await prisma().idempotencyRecord.create({ data: { scope, key, requestHash, expiresAt } });
      return { state: "claimed" };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
    const row = await prisma().idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
    if (row === null) return { state: "in_progress" };
    const response =
      row.status === "completed" && row.responseCode !== null
        ? { status: row.responseCode, body: JSON.stringify(row.responseBody ?? null) }
        : undefined;
    return decideIdempotencyClaimFromRecord({ requestHash: row.requestHash, expiresAt: row.expiresAt, ...(response ? { response } : {}) }, requestHash) ?? { state: "in_progress" };
  }

  public async complete(scope: string, key: string, response: StoredResponse): Promise<void> {
    await prisma().idempotencyRecord.updateMany({
      where: { scope, key },
      data: { status: "completed", responseCode: response.status, responseBody: JSON.parse(response.body === "" ? "null" : response.body) },
    });
  }

  public async release(scope: string, key: string): Promise<void> {
    await prisma().idempotencyRecord.deleteMany({ where: { scope, key, status: "in_progress" } });
  }
}
