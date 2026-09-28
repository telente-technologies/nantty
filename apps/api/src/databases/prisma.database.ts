import { setTimeout as delay } from "node:timers/promises";

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../integrations/database.integration.js";

export type TransactionClient = Prisma.TransactionClient;

const MAX_ATTEMPTS = 4;

function isSerializationFailureError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2034" || error.message.includes("40001");
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function runInSerializableTransaction<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma().$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isSerializationFailureError(error)) throw error;
      await delay(attempt * 25 + Math.floor(Math.random() * 25));
    }
  }
}
