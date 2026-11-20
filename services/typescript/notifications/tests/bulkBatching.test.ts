import { beforeEach, describe, expect, it } from "vitest";

import { ProcessBulkBatchHandler } from "../src/modules/bulkCampaigns/commands/processBulkBatch/processBulkBatch.handler.js";
import { QueueAdminEmailHandler } from "../src/modules/bulkCampaigns/commands/queueAdminEmail/queueAdminEmail.handler.js";
import { QueueLegalNoticeHandler } from "../src/modules/bulkCampaigns/commands/queueLegalNotice/queueLegalNotice.handler.js";
import { AudiencePlannerService } from "../src/modules/bulkCampaigns/services/audiencePlanner.service.js";
import { planBatches } from "../src/modules/bulkCampaigns/services/batchPlan.service.js";
import { LegalAudienceService } from "../src/modules/bulkCampaigns/services/legalAudience.service.js";
import { createTestHarness, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const actor = { id: "staff1", name: "Legal Lead" };
let harness: TestHarness;
let processBatch: ProcessBulkBatchHandler;
const pauses: number[] = [];

function createProcessor() {
  return new ProcessBulkBatchHandler({ campaigns: harness.campaigns, identity: harness.identity, emailDelivery: harness.emailDelivery, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", pause: async (milliseconds) => void pauses.push(milliseconds), now: harness.now });
}

function createLegalQueue(batchSize = 2) {
  const audience = new LegalAudienceService(harness.identity, harness.suppressions, batchSize, 10);
  return new QueueLegalNoticeHandler({ drafts: harness.drafts, campaigns: harness.campaigns, audience, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", identity: harness.identity, batchSize, ratePerSecond: 10, acceptUrl: "https://nantty.com/settings/legal/accept" });
}

async function runJobsToCompletion() {
  for (let guard = 0; guard < 50; guard += 1) {
    const jobs = harness.jobQueue.takeAll();
    if (jobs.length === 0) return;
    for (const job of jobs) await processBatch.execute({ campaignId: String(job.body["campaignId"]), batchIndex: Number(job.body["batchIndex"]), cursor: (job.body["cursor"] as string | null) ?? null });
  }
}

beforeEach(async () => {
  harness = createTestHarness();
  pauses.length = 0;
  processBatch = createProcessor();
  harness.identity.audience = ["a", "b", "c", "d", "e"].map((id) => makeRecipient({ accountId: id, email: `${id}@example.com`, firstName: id.toUpperCase(), marketingConsent: id === "a" }));
  await harness.drafts.createIfAbsent({
    versionId: "terms:7", documentKey: "terms", documentTitle: "Terms of Service", versionNumber: 7, subject: "We've updated our Terms of Service", summaryText: "We clarified escrow release.",
    whatChanged: ["Clarified escrow release timing"], effectiveAt: new Date("2026-11-03T00:00:00.000Z"), reacceptNote: null, requiresReacceptance: true, documentUrl: "https://nantty.com/terms",
  });
});

describe("batch planning", () => {
  it("rounds batches up and estimates duration from the send rate", () => {
    expect(planBatches(5, 2, 10)).toEqual({ batchesTotal: 3, estimatedSeconds: 1 });
    expect(planBatches(0, 200, 14)).toEqual({ batchesTotal: 0, estimatedSeconds: 0 });
    expect(planBatches(1_000_000, 500, 14)).toEqual({ batchesTotal: 2000, estimatedSeconds: 71429 });
  });
});

describe("policy notice fan-out", () => {
  it("sends to everyone regardless of marketing consent, in throttled batches with progress", async () => {
    const progress = await createLegalQueue().execute({ versionId: "terms:7", reason: "Annual review", actor });
    expect(progress).toMatchObject({ status: "QUEUED", recipientCount: 5, batchesTotal: 3, batchSize: 2, provider: "AWS_SES", queuedByName: "Legal Lead" });
    expect(harness.jobQueue.jobs).toHaveLength(1);

    const [first] = harness.jobQueue.takeAll();
    await processBatch.execute({ campaignId: String(first!.body["campaignId"]), batchIndex: 0, cursor: null });
    expect(harness.sender.sent).toHaveLength(2);
    expect(harness.campaigns.rows[0]).toMatchObject({ status: "SENDING", batchesDone: 1, sentCount: 2 });
    expect(harness.jobQueue.jobs).toHaveLength(1);

    harness.jobQueue.jobs.length = 0;
    await processBatch.execute({ campaignId: String(first!.body["campaignId"]), batchIndex: 1, cursor: "2" });
    await processBatch.execute({ campaignId: String(first!.body["campaignId"]), batchIndex: 2, cursor: "4" });
    expect(harness.sender.sent.map((email) => email.to)).toEqual(["a@example.com", "b@example.com", "c@example.com", "d@example.com", "e@example.com"]);
    expect(harness.campaigns.rows[0]).toMatchObject({ status: "COMPLETED", batchesDone: 3, sentCount: 5, nextCursor: null });
    expect(harness.sender.sent.every((email) => email.headers === undefined)).toBe(true);
  });

  it("throttles each send to the configured rate", async () => {
    await createLegalQueue().execute({ versionId: "terms:7", reason: "Annual review", actor });
    await runJobsToCompletion();
    expect(pauses).toHaveLength(5);
    expect(new Set(pauses)).toEqual(new Set([100]));
  });

  it("skips hard-bounced addresses but still sends to complaint-suppressed ones", async () => {
    harness.suppressions.rows.set("b@example.com", "hard_bounce");
    harness.suppressions.rows.set("c@example.com", "complaint");
    const progress = await createLegalQueue().execute({ versionId: "terms:7", reason: "Annual review", actor });
    expect(progress).toMatchObject({ recipientCount: 4, excludedHardBounces: 1, excludedSuppressed: 0 });
    await runJobsToCompletion();
    expect(harness.sender.sent.map((email) => email.to)).toEqual(["a@example.com", "c@example.com", "d@example.com", "e@example.com"]);
  });

  it("does not double send or double count when a batch job is delivered twice", async () => {
    await createLegalQueue().execute({ versionId: "terms:7", reason: "Annual review", actor });
    const [first] = harness.jobQueue.takeAll();
    const command = { campaignId: String(first!.body["campaignId"]), batchIndex: 0, cursor: null };
    await processBatch.execute(command);
    harness.jobQueue.takeAll();
    const replay = await processBatch.execute(command);
    expect(replay.processed).toBe(false);
    expect(harness.sender.sent).toHaveLength(2);
    expect(harness.campaigns.rows[0]?.sentCount).toBe(2);
    expect(harness.jobQueue.jobs).toHaveLength(1);
  });

  it("refuses a second notice for a version that is still sending, and an unpublished version", async () => {
    const queue = createLegalQueue();
    await queue.execute({ versionId: "terms:7", reason: "Annual review", actor });
    await expect(queue.execute({ versionId: "terms:7", reason: "Again", actor })).rejects.toMatchObject({ status: 409, code: "NOTICE_IN_PROGRESS" });
    await expect(queue.execute({ versionId: "terms:99", reason: "Nope", actor })).rejects.toMatchObject({ status: 409, code: "NOT_PUBLISHED" });
  });
});

describe("admin email queue", () => {
  const createAdminQueue = () => new QueueAdminEmailHandler({ planner: new AudiencePlannerService(harness.identity), campaigns: harness.campaigns, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", identity: harness.identity, batchSize: 2, ratePerSecond: 10 });

  beforeEach(() => {
    harness.identity.segments = [{ id: "sellers", label: "All sellers", description: "Everyone with a store.", recipientCount: 5, marketingConsentCount: 1 }];
  });

  it("sends marketing only to people with marketing consent, with an unsubscribe link and header", async () => {
    const record = await createAdminQueue().execute({ kind: "MARKETING", subject: "What is new", body: "Hi {{firstName}}, new features are live.", audience: { type: "SEGMENT", segmentId: "sellers" }, reason: "Monthly news", actor });
    expect(record).toMatchObject({ kind: "MARKETING", recipientCount: 1, skippedNoMarketingConsent: 4, provider: "AWS_SES" });
    await runJobsToCompletion();
    expect(harness.sender.sent).toHaveLength(1);
    const email = harness.sender.sent[0]!;
    expect(email.to).toBe("a@example.com");
    expect(email.html).toContain("nantty-lockup.png");
    expect(email.html).toContain("NANTTY_COMPANY_LEGAL_NAME");
    expect(email.text).toContain("Hi A,");
    expect(email.text).toMatch(/Unsubscribe: https:\/\/api\.nantty\.test\/api\/v1\/email\/unsubscribe\?token=/);
    expect(email.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(harness.identity.audits[0]).toMatchObject({ action: "support.email_sent", actorId: "staff1" });
  });

  it("enforces the weekly marketing frequency cap across campaigns", async () => {
    const queue = createAdminQueue();
    for (let index = 0; index < 3; index += 1) {
      await queue.execute({ kind: "MARKETING", subject: `Promo ${index}`, body: "Hello {{firstName}}, a promo just for you.", audience: { type: "SEGMENT", segmentId: "sellers" }, reason: "Campaign", actor });
      await runJobsToCompletion();
    }
    expect(harness.sender.sent).toHaveLength(2);
  });

  it("sends transactional email to the whole segment without a marketing footer", async () => {
    await createAdminQueue().execute({ kind: "TRANSACTIONAL", subject: "Service notice", body: "Hello {{firstName}}, scheduled maintenance tonight.", audience: { type: "SEGMENT", segmentId: "sellers" }, reason: "Maintenance", actor });
    await runJobsToCompletion();
    expect(harness.sender.sent).toHaveLength(5);
    expect(harness.sender.sent[0]?.html).toContain("nantty-lockup.png");
    expect(harness.sender.sent[0]?.text).not.toContain("Unsubscribe");
  });

  it("refuses a marketing send to a single user without consent", async () => {
    harness.identity.add(makeRecipient({ accountId: "solo", username: "solo", marketingConsent: false }));
    await expect(createAdminQueue().execute({ kind: "MARKETING", subject: "Hello there", body: "A friendly note for you today.", audience: { type: "USER", username: "@solo" }, reason: "Outreach", actor })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("sends a transactional email to one user by username", async () => {
    harness.identity.add(makeRecipient({ accountId: "solo", username: "solo", email: "solo@example.com" }));
    await createAdminQueue().execute({ kind: "TRANSACTIONAL", subject: "About your account", body: "Hi {{firstName}}, a note from support.", audience: { type: "USER", username: "solo" }, reason: "Support", actor });
    await runJobsToCompletion();
    expect(harness.sender.sent.map((email) => email.to)).toEqual(["solo@example.com"]);
  });
});
