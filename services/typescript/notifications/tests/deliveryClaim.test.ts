import { describe, expect, it } from "vitest";

import type { PrismaClient } from "../src/databases/prisma.database.js";
import { DeliveryPrismaRepository } from "../src/modules/delivery/repositories/delivery.prisma.repository.js";
import { Prisma } from "../src/generated/prisma/client.js";

function repositoryWithExistingDelivery(status: string, updatedAt = new Date()) {
  const row = { id: "delivery-1", dedupeKey: "event-1:user-1:email", status, updatedAt };
  const prisma = {
    delivery: {
      create: async () => { throw new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }); },
      findUniqueOrThrow: async () => ({ ...row }),
      updateMany: async ({ where, data }: { where: { id: string; status: string; updatedAt?: { lt: Date } }; data: { status: string; skipReason: null } }) => {
        if (row.id !== where.id || row.status !== where.status) return { count: 0 };
        if (where.updatedAt !== undefined && row.updatedAt >= where.updatedAt.lt) return { count: 0 };
        Object.assign(row, data);
        row.updatedAt = new Date();
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  return new DeliveryPrismaRepository(prisma);
}

const input = { dedupeKey: "event-1:user-1:email", eventId: "event-1", userId: "user-1", channel: "email" as const, templateKey: "welcome", mailKind: "transactional" as const };

describe("email delivery claims", () => {
  it("does not reclaim an in-flight pending delivery", async () => {
    const claim = await repositoryWithExistingDelivery("pending").claim(input);
    expect(claim).toMatchObject({ id: "delivery-1", status: "pending", alreadyProcessed: true });
  });

  it("atomically reclaims an abandoned pending delivery after its lease expires", async () => {
    const claim = await repositoryWithExistingDelivery("pending", new Date(Date.now() - 16 * 60 * 1000)).claim(input);
    expect(claim).toMatchObject({ id: "delivery-1", status: "pending", alreadyProcessed: false });
  });

  it("allows only one concurrent retry to claim a failed delivery", async () => {
    const repository = repositoryWithExistingDelivery("failed");
    const claims = await Promise.all([repository.claim(input), repository.claim(input)]);
    expect(claims.filter((claim) => !claim.alreadyProcessed)).toHaveLength(1);
    expect(claims.filter((claim) => claim.alreadyProcessed)).toHaveLength(1);
  });
});
