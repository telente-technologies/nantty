import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient, type PrismaClient } from "../src/databases/prisma.database.js";
import { DeliveryPrismaRepository } from "../src/modules/delivery/repositories/delivery.prisma.repository.js";
import { CampaignPrismaRepository } from "../src/modules/bulkCampaigns/repositories/campaign.prisma.repository.js";
import { NotificationPrismaRepository } from "../src/modules/inbox/repositories/notification.prisma.repository.js";
import { PreferencePrismaRepository } from "../src/modules/inbox/repositories/preference.prisma.repository.js";
import { SuppressionPrismaRepository } from "../src/modules/suppression/repositories/suppression.prisma.repository.js";

const databaseUrl = process.env["NOTIFICATIONS_INTEGRATION_DATABASE_URL"];
const suite = databaseUrl === undefined ? describe.skip : describe;

suite("notifications repositories against Postgres (run after prisma migrate deploy)", () => {
  let prisma: PrismaClient;
  const userId = `it-${Date.now()}`;

  beforeAll(() => { prisma = createPrismaClient({ databaseUrl: databaseUrl!, databaseSchema: process.env["NOTIFICATIONS_INTEGRATION_SCHEMA"] ?? "notifications" }); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("dedupes in-app notifications, pages by cursor, filters mentions and marks read", async () => {
    const repository = new NotificationPrismaRepository(prisma);
    const base = { userId, templateKey: null, body: "b", actor: null, data: {}, category: "social" as const };
    expect(await repository.insertIfAbsent({ ...base, dedupeKey: `${userId}:1`, kind: "mention", title: "one" })).not.toBeNull();
    expect(await repository.insertIfAbsent({ ...base, dedupeKey: `${userId}:1`, kind: "mention", title: "one" })).toBeNull();
    await repository.insertIfAbsent({ ...base, dedupeKey: `${userId}:2`, kind: null, title: "two" });
    const first = await repository.list(userId, "all", 1, null);
    expect(first.rows).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    expect((await repository.list(userId, "all", 1, first.nextCursor)).rows).toHaveLength(1);
    expect((await repository.list(userId, "mentions", 10, null)).rows.map((row) => row.title)).toEqual(["one"]);
    expect(await repository.countUnread(userId)).toBe(2);
    expect(await repository.markAllRead(userId, new Date())).toBe(2);
    expect(await repository.countUnread(userId)).toBe(0);
  });

  it("claims a delivery once, allows retry after failure, and counts sent marketing emails", async () => {
    const repository = new DeliveryPrismaRepository(prisma);
    const input = { dedupeKey: `${userId}:d1`, eventId: `${userId}:evt`, userId, channel: "email" as const, templateKey: "pickedForYou", mailKind: "marketing" as const };
    const first = await repository.claim(input);
    expect(first.alreadyProcessed).toBe(false);
    await repository.finish(first.id, "failed", { skipReason: "ses down" });
    const retry = await repository.claim(input);
    expect(retry).toMatchObject({ id: first.id, alreadyProcessed: false });
    await repository.finish(retry.id, "sent", { providerMessageId: `${userId}-msg` });
    expect((await repository.claim(input)).alreadyProcessed).toBe(true);
    expect(await repository.countSentEmails(userId, "marketing", new Date(Date.now() - 60_000))).toBe(1);
    expect(await repository.findUserIdByProviderMessageId(`${userId}-msg`)).toBe(userId);
  });

  it("upserts preferences and never downgrades a hard bounce", async () => {
    const preferences = new PreferencePrismaRepository(prisma);
    await preferences.upsert(userId, "orders", { email: false });
    expect(await preferences.list(userId)).toEqual([{ category: "orders", push: true, email: false }]);
    const suppressions = new SuppressionPrismaRepository(prisma);
    const email = `${userId}@example.com`;
    await suppressions.upsert(email, "hard_bounce", "test");
    await suppressions.upsert(email.toUpperCase(), "complaint", "test");
    expect(await suppressions.find(email)).toBe("hard_bounce");
  });

  it("only applies a campaign batch once", async () => {
    const campaigns = new CampaignPrismaRepository(prisma);
    const campaign = await campaigns.create({
      kind: "ADMIN_EMAIL", subject: "s", payload: { body: "b" }, audienceKind: "SEGMENT", audienceRef: "all", audienceLabel: "All", mailKind: "transactional", recipientCount: 3, skippedNoMarketingConsent: 0,
      skippedHardBounces: 0, skippedSuppressed: 0, batchSize: 2, ratePerSecond: 10, batchesTotal: 2, reason: "test", queuedById: "s1", queuedByName: "Staff", versionId: null,
    });
    expect(await campaigns.applyBatchProgress(campaign.id, 0, { sentCount: 2, failedCount: 0, nextCursor: "2" }, null)).toBe(true);
    expect(await campaigns.applyBatchProgress(campaign.id, 0, { sentCount: 2, failedCount: 0, nextCursor: "2" }, null)).toBe(false);
    expect(await campaigns.findById(campaign.id)).toMatchObject({ sentCount: 2, batchesDone: 1, status: "SENDING" });
  });
});
