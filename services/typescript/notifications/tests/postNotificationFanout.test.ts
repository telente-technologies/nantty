import { beforeEach, describe, expect, it } from "vitest";

import { createJobMessageHandler } from "../src/jobs/messageRouting.job.js";
import { PoisonMessageError } from "../src/errors/poisonMessage.error.js";
import type { PostNotificationScope, PostNotificationSubscriberSource } from "../src/interfaces/postNotificationSubscribers.interface.js";
import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { RunPostNotificationFanoutHandler } from "../src/modules/postNotifications/commands/runPostNotificationFanout/runPostNotificationFanout.handler.js";
import { planPostNotificationFanout, type PostNotificationFanoutJob } from "../src/modules/postNotifications/services/postNotificationContent.service.js";
import { createTestHarness, makeEvent, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const author = "11111111-1111-4111-8111-111111111111";
const clip = { postId: "p1", authorId: author, kind: "clip", audience: "everyone", visibility: "public", isAiGenerated: false, authorProfileId: null, isVideoReply: false };
const lookupAuthor = async (accountId: string) => (accountId === author ? { username: "adaeze" } : null);

class PagedSubscribers implements PostNotificationSubscriberSource {
  public readonly calls: { scope: PostNotificationScope; cursor: string | null; limit: number }[] = [];
  public constructor(private readonly userIds: readonly string[]) {}
  public async listPage(_authorId: string, scope: PostNotificationScope, cursor: string | null, limit: number) {
    this.calls.push({ scope, cursor, limit });
    const start = cursor === null ? 0 : Number(cursor);
    return { data: this.userIds.slice(start, start + limit).map((userId) => ({ userId })), nextCursor: start + limit < this.userIds.length ? String(start + limit) : null };
  }
}

let harness: TestHarness;
const fanoutFor = (source: PostNotificationSubscriberSource, batchSize = 200) =>
  new RunPostNotificationFanoutHandler({ source, dispatcher: harness.dispatcher, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", batchSize, lookupAuthor });

async function drain(fanout: RunPostNotificationFanoutHandler): Promise<number> {
  let pages = 0;
  for (let job = harness.jobQueue.takeAll()[0]; job !== undefined; job = harness.jobQueue.takeAll()[0]) {
    await fanout.execute(job.body as unknown as PostNotificationFanoutJob);
    pages += 1;
  }
  return pages;
}

beforeEach(() => {
  harness = createTestHarness();
});

describe("which events fan out", () => {
  it("fans out public posts and clips, never stories, video replies, subscriber-only or business-profile posts", async () => {
    expect(await planPostNotificationFanout(makeEvent("post.created", clip), lookupAuthor)).toMatchObject({ scope: "posts", authorId: author, content: { kind: "clip", targetId: "p1", author: { username: "adaeze" } } });
    expect(await planPostNotificationFanout(makeEvent("post.created", { ...clip, kind: "story" }), lookupAuthor)).toBeNull();
    expect(await planPostNotificationFanout(makeEvent("post.created", { ...clip, isVideoReply: true }), lookupAuthor)).toBeNull();
    expect(await planPostNotificationFanout(makeEvent("post.created", { ...clip, visibility: "subscribers" }), lookupAuthor)).toBeNull();
    expect(await planPostNotificationFanout(makeEvent("post.created", { ...clip, authorProfileId: "brand-1" }), lookupAuthor)).toBeNull();
    expect(await planPostNotificationFanout(makeEvent("post.created", { ...clip, authorId: "unknown" }), lookupAuthor)).toBeNull();
  });

  it("fans out lives to posts_and_lives subscribers unless the live is for paying subscribers only", async () => {
    const live = { liveId: "l1", hostId: author, title: "Friday drop", hostName: "Adaeze", hostHandle: "adaeze", visibility: "public", notifyUserIds: [] };
    expect(await planPostNotificationFanout(makeEvent("live.started", live), lookupAuthor)).toMatchObject({ scope: "lives", content: { kind: "live", title: "Friday drop" } });
    expect(await planPostNotificationFanout(makeEvent("live.started", { ...live, visibility: "subscribers" }), lookupAuthor)).toBeNull();
  });
});

describe("batched fan-out", () => {
  it("delivers to 10k subscribers in pages of 200, skips the author and chains one job per page", async () => {
    const subscribers = [author, ...Array.from({ length: 10_000 }, (_, index) => `fan-${index}`)];
    const source = new PagedSubscribers(subscribers);
    const fanout = fanoutFor(source);
    harness.deviceTokens.tokens.set("token-fan-0", "fan-0");
    expect(await fanout.startFromEvent(makeEvent("post.created", clip))).toBe(true);
    const pages = await drain(fanout);
    expect(pages).toBe(51);
    expect(source.calls.every((call) => call.limit === 200 && call.scope === "posts")).toBe(true);
    expect(harness.notifications.rows).toHaveLength(10_000);
    expect(harness.notifications.rows.some((row) => row.userId === author)).toBe(false);
    const first = harness.notifications.rows.find((row) => row.userId === "fan-0");
    expect(first).toMatchObject({ title: "@adaeze", body: "posted a new clip.", data: { url: "/clips/p1", postId: "p1" } });
    expect(harness.pushSender.sent).toEqual([{ tokens: ["token-fan-0"], content: { title: "@adaeze posted a new clip", body: "Tap to watch.", data: { url: "/clips/p1", postId: "p1" } } }]);
  }, 30_000);

  it("does not duplicate on a retried page and respects a turned-off social push preference", async () => {
    const fanout = fanoutFor(new PagedSubscribers(["fan-a"]));
    harness.deviceTokens.tokens.set("token-a", "fan-a");
    await harness.preferences.upsert("fan-a", "social", { push: false });
    await fanout.startFromEvent(makeEvent("post.created", { ...clip, kind: "post" }));
    const [job] = harness.jobQueue.takeAll();
    await fanout.execute(job!.body as unknown as PostNotificationFanoutJob);
    await fanout.execute(job!.body as unknown as PostNotificationFanoutJob);
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.notifications.rows[0]).toMatchObject({ body: "posted a new post.", data: { url: "/post/p1" } });
    expect(harness.pushSender.sent).toHaveLength(0);
  });

  it("skips push when the recipient turned push off account-wide", async () => {
    harness.identity.add(makeRecipient({ accountId: "fan-b", pushEnabled: false }));
    harness.deviceTokens.tokens.set("token-b", "fan-b");
    const fanout = fanoutFor(new PagedSubscribers(["fan-b"]));
    await fanout.startFromEvent(makeEvent("post.created", clip));
    await drain(fanout);
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});

describe("domain event ingestion", () => {
  it("handles post.created by queueing the fan-out and live.started by alerting followers once each", async () => {
    const source = new PagedSubscribers(["u1", "u9"]);
    const fanout = fanoutFor(source);
    const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger, undefined, fanout);
    expect(await handler.execute({ event: makeEvent("post.created", clip) })).toMatchObject({ handled: true, reason: "post_notification_fanout" });
    expect(harness.jobQueue.takeAll()).toHaveLength(1);
    const live = { liveId: "l1", hostId: author, title: "Friday drop", category: "fashion", hostName: "Adaeze", hostHandle: "adaeze", visibility: "public", notifyUserIds: ["u1"] };
    await handler.execute({ event: makeEvent("live.started", live, "evt-live") });
    await drain(fanout);
    expect(source.calls.at(-1)?.scope).toBe("lives");
    expect(harness.notifications.rows.filter((row) => row.userId === "u1")).toHaveLength(1);
    expect(harness.notifications.rows.find((row) => row.userId === "u9")).toMatchObject({ title: "@adaeze", body: "is live: Friday drop", data: { liveId: "l1", url: "/live/l1" } });
  });

  it("dead-letters a malformed fan-out job", async () => {
    const handlers = { runPostNotificationFanout: fanoutFor(new PagedSubscribers([])) } as never;
    await expect(createJobMessageHandler(handlers, silentLogger)(JSON.stringify({ type: "postNotifications.fanout", eventId: "e" }))).rejects.toBeInstanceOf(PoisonMessageError);
  });
});
