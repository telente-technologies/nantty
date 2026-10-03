import { beforeEach, describe, expect, it } from "vitest";

import { computeDuePeriods, DigestSchedulerJob } from "../src/jobs/digestScheduler.job.js";
import type { DigestKind, DigestSource } from "../src/interfaces/digestSource.interface.js";
import { RunDigestBatchHandler } from "../src/modules/digests/commands/runDigestBatch/runDigestBatch.handler.js";
import { createTestHarness, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

let harness: TestHarness;
const people = { totalPending: 1, requests: [{ name: "Chinedu", handle: "chinedu" }] };
const weekly = { weekLabel: "Oct 5", trending: [], upcomingLives: [] };

function source(entries: Record<DigestKind, { userId: string; props: Record<string, unknown> }[]>): DigestSource {
  return { listPage: async (kind, cursor, limit) => { const start = cursor === null ? 0 : Number(cursor); const data = entries[kind].slice(start, start + limit); return { data, nextCursor: start + limit < entries[kind].length ? String(start + limit) : null }; } };
}

const handlerFor = (digestSource: DigestSource) => new RunDigestBatchHandler({ source: digestSource, identity: harness.identity, emailDelivery: harness.emailDelivery, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", batchSize: 1 });

beforeEach(() => {
  harness = createTestHarness();
  harness.identity.add(makeRecipient({ accountId: "a", email: "a@example.com", marketingConsent: true }));
  harness.identity.add(makeRecipient({ accountId: "b", email: "b@example.com", marketingConsent: false }));
});

describe("digest emails", () => {
  it("sends the weekly digest only to people with marketing consent and chains the next page", async () => {
    const handler = handlerFor(source({ weekly: [{ userId: "a", props: weekly }, { userId: "b", props: weekly }], followRequests: [], messageRequests: [] }));
    expect((await handler.execute({ kind: "weekly", periodKey: "2026-10-05", cursor: null })).sent).toBe(1);
    expect(harness.jobQueue.jobs[0]?.body).toMatchObject({ type: "digest.run", cursor: "1" });
    await handler.execute({ kind: "weekly", periodKey: "2026-10-05", cursor: "1" });
    expect(harness.sender.sent.map((email) => email.to)).toEqual(["a@example.com"]);
    expect(harness.sender.sent[0]?.headers?.["List-Unsubscribe-Post"]).toBeDefined();
  });

  it("sends one digest per user per period, so a replayed job or cap-free daily digest never duplicates", async () => {
    const handler = handlerFor(source({ weekly: [], followRequests: [{ userId: "b", props: people }], messageRequests: [] }));
    await handler.execute({ kind: "followRequests", periodKey: "2026-10-03", cursor: null });
    await handler.execute({ kind: "followRequests", periodKey: "2026-10-03", cursor: null });
    expect(harness.sender.sent).toHaveLength(1);
    await handler.execute({ kind: "followRequests", periodKey: "2026-10-04", cursor: null });
    expect(harness.sender.sent).toHaveLength(2);
  });

  it("respects the weekly marketing frequency cap and the per-category email preference", async () => {
    await harness.preferences.upsert("b", "social", { email: false });
    const handler = handlerFor(source({ weekly: [], followRequests: [{ userId: "b", props: people }], messageRequests: [] }));
    await handler.execute({ kind: "followRequests", periodKey: "2026-10-03", cursor: null });
    expect(harness.sender.sent).toHaveLength(0);
  });
});

describe("digest schedule", () => {
  it("queues daily digests after 09:00 UTC and the weekly digest on Mondays, once per period", async () => {
    expect(computeDuePeriods(new Date("2026-10-03T08:00:00Z"))).toEqual([]);
    expect(computeDuePeriods(new Date("2026-10-03T10:00:00Z")).map((due) => due.kind)).toEqual(["followRequests", "messageRequests"]);
    expect(computeDuePeriods(new Date("2026-10-05T10:00:00Z"))).toContainEqual({ kind: "weekly", periodKey: "2026-10-05" });
    const scheduler = new DigestSchedulerJob(harness.jobQueue, "jobs-queue", () => new Date("2026-10-05T10:00:00Z"));
    expect(await scheduler.tick()).toBe(3);
    expect(await scheduler.tick()).toBe(0);
  });
});
