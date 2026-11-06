import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient, type PrismaClient } from "../src/databases/prisma.database.js";
import { ReengagementPrismaRepository } from "../src/modules/reengagement/repositories/reengagement.prisma.repository.js";

const databaseUrl = process.env["NOTIFICATIONS_INTEGRATION_DATABASE_URL"];
const suite = databaseUrl === undefined ? describe.skip : describe;

suite("re-engagement durable scheduling against Postgres (run after prisma migrate deploy)", () => {
  let prisma: PrismaClient;
  const accountId = randomUUID();

  beforeAll(() => { prisma = createPrismaClient({ databaseUrl: databaseUrl!, databaseSchema: process.env["NOTIFICATIONS_INTEGRATION_SCHEMA"] ?? "notifications" }); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("persists real heartbeats, creates campaign/content-deduped jobs, and claims at most one weekly send", async () => {
    const repository = new ReengagementPrismaRepository(prisma);
    const now = new Date("2026-11-06T12:00:00.000Z");
    const lastActivityAt = new Date("2026-10-01T12:00:00.000Z");
    await repository.recordActivity(accountId, "Africa/Lagos", lastActivityAt);
    const due = { now, inactiveBefore: new Date("2026-10-23T12:00:00.000Z"), cooldownBefore: new Date("2026-10-30T12:00:00.000Z"), campaignId: "integration-v1", contentKey: "generic-v1", limit: 20 };
    expect(await repository.createDueDeliveries(due)).toBe(1);
    expect(await repository.createDueDeliveries(due)).toBe(0);
    const pending = await repository.listPending({ now, inactiveBefore: due.inactiveBefore, limit: 5 });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.activity.timeZone).toBe("Africa/Lagos");
    const leaseToken = randomUUID();
    expect(await repository.leaseForQueue(pending[0]!.id, now, new Date(now.getTime() + 300_000), leaseToken)).toBe(true);
    expect(await repository.leaseForQueue(pending[0]!.id, now, new Date(now.getTime() + 300_000), randomUUID())).toBe(false);
    await repository.releaseQueueLease(pending[0]!.id, leaseToken);
    expect(await repository.claimDispatch({ id: pending[0]!.id, now, inactiveBefore: due.inactiveBefore, cooldownBefore: due.cooldownBefore })).toBe("claimed");
    expect(await repository.claimDispatch({ id: pending[0]!.id, now, inactiveBefore: due.inactiveBefore, cooldownBefore: due.cooldownBefore })).toBe("already_claimed");
    await repository.finish(pending[0]!.id, "sent");

    const anotherCampaign = { ...due, campaignId: "integration-v2", contentKey: "generic-v2" };
    await prisma.reengagementDelivery.create({ data: { accountId, campaignId: anotherCampaign.campaignId, contentKey: anotherCampaign.contentKey, dedupeKey: `${accountId}:${anotherCampaign.campaignId}:${anotherCampaign.contentKey}`, activityAt: lastActivityAt } });
    const second = await repository.listPending({ now, inactiveBefore: due.inactiveBefore, limit: 5 });
    expect(await repository.claimDispatch({ id: second[0]!.id, now, inactiveBefore: due.inactiveBefore, cooldownBefore: due.cooldownBefore })).toBe("frequency_cap");
  });
});
