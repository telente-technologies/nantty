import { describe, expect, it } from "vitest";

import { createJobMessageHandler } from "../src/jobs/messageRouting.job.js";
import type { PostNotificationScope, PostNotificationSubscriberSource } from "../src/interfaces/postNotificationSubscribers.interface.js";
import { SendWidgetRefreshHandler, type WidgetRefreshFanoutJob } from "../src/modules/widgetRefresh/commands/sendWidgetRefresh/sendWidgetRefresh.handler.js";
import { planWidgetRefresh, widgetRefreshDedupeKey } from "../src/modules/widgetRefresh/services/widgetRefreshPlanner.service.js";
import { InMemoryDeliveryRepository, InMemoryDeviceTokenRepository } from "./fakes/inMemoryRepositories.fake.js";
import { RecordingJobQueue, RecordingPushSender } from "./fakes/inMemoryServices.fake.js";
import { makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

class FollowersWithBell implements PostNotificationSubscriberSource {
  public readonly scopes: PostNotificationScope[] = [];
  public constructor(private readonly userIds: readonly string[]) {}
  public async listPage(_authorId: string, scope: PostNotificationScope, cursor: string | null, limit: number) {
    this.scopes.push(scope);
    const start = cursor === null ? 0 : Number(cursor);
    return { data: this.userIds.slice(start, start + limit).map((userId) => ({ userId })), nextCursor: start + limit < this.userIds.length ? String(start + limit) : null };
  }
}

function setup(now: { value: Date }, storyAudience: PostNotificationSubscriberSource | null = null) {
  const deliveries = new InMemoryDeliveryRepository();
  const deviceTokens = new InMemoryDeviceTokenRepository();
  const pushSender = new RecordingPushSender();
  const jobQueue = new RecordingJobQueue();
  const handler = new SendWidgetRefreshHandler({ deliveries, deviceTokens, pushSender, jobQueue, jobsQueueUrl: "jobs", storyAudience, batchSize: 2, maximumDirectRecipients: 3, logger: silentLogger, now: () => now.value });
  return { deliveries, deviceTokens, pushSender, jobQueue, handler };
}

describe("widget refresh planning", () => {
  it("maps order, live and story events to the widgets they change", () => {
    const paid = planWidgetRefresh(makeEvent("order.paid", { buyerUserId: "buyer", groups: [{ sellerUserId: "seller-a" }, { sellerUserId: "seller-b" }] }), 10);
    expect(paid.targets).toEqual([{ userId: "buyer", widget: "orders" }, { userId: "seller-a", widget: "sellerToday" }, { userId: "seller-b", widget: "sellerToday" }]);
    expect(planWidgetRefresh(makeEvent("order.shipped", { buyerUserId: "buyer" }), 10).targets).toEqual([{ userId: "buyer", widget: "orders" }]);
    expect(planWidgetRefresh(makeEvent("live.started", { notifyUserIds: ["a", "b", "c", "d"] }), 2).targets).toHaveLength(2);
    expect(planWidgetRefresh(makeEvent("post.created", { kind: "story", authorId: "author" }), 10).storyAuthorId).toBe("author");
    expect(planWidgetRefresh(makeEvent("post.created", { kind: "post", authorId: "author" }), 10).storyAuthorId).toBeNull();
    expect(planWidgetRefresh(makeEvent("order.paid", { groups: "not-a-list" }), 10).targets).toEqual([]);
  });

  it("buckets the dedupe key per widget so pushes stay within budget", () => {
    const at = new Date("2026-10-10T10:00:00Z");
    const target = { userId: "u", widget: "orders" as const };
    expect(widgetRefreshDedupeKey(target, at)).toBe(widgetRefreshDedupeKey(target, new Date(at.getTime() + 4 * 60_000)));
    expect(widgetRefreshDedupeKey(target, at)).not.toBe(widgetRefreshDedupeKey(target, new Date(at.getTime() + 5 * 60_000)));
  });
});

describe("widget refresh delivery", () => {
  it("sends one silent data-only push per user and widget within the budget window", async () => {
    const now = { value: new Date("2026-10-10T10:00:00Z") };
    const { deviceTokens, pushSender, handler } = setup(now);
    await deviceTokens.register("buyer", "ExponentPushToken[buyer]", "ios");
    expect(await handler.refreshFromEvent(makeEvent("order.shipped", { buyerUserId: "buyer" }, "evt-1"))).toBe(1);
    expect(await handler.refreshFromEvent(makeEvent("order.delivered", { buyerUserId: "buyer" }, "evt-2"))).toBe(0);
    now.value = new Date(now.value.getTime() + 6 * 60_000);
    expect(await handler.refreshFromEvent(makeEvent("order.delivered", { buyerUserId: "buyer" }, "evt-3"))).toBe(1);
    expect(pushSender.sent).toHaveLength(0);
    expect(pushSender.silent).toEqual([
      { tokens: ["ExponentPushToken[buyer]"], data: { type: "widgetRefresh", widgets: ["orders"] } },
      { tokens: ["ExponentPushToken[buyer]"], data: { type: "widgetRefresh", widgets: ["orders"] } },
    ]);
  });

  it("fans story refreshes out through paged jobs and never pushes the author", async () => {
    const audience = new FollowersWithBell(["f1", "author", "f2", "f3"]);
    const { deviceTokens, pushSender, jobQueue, handler } = setup({ value: new Date("2026-10-10T10:00:00Z") }, audience);
    for (const userId of ["f1", "f2", "f3", "author"]) await deviceTokens.register(userId, `token-${userId}`, "android");
    await handler.refreshFromEvent(makeEvent("post.created", { kind: "story", authorId: "author", postId: "s1" }, "evt-story"));
    const route = createJobMessageHandler({ sendWidgetRefresh: handler } as never, silentLogger);
    for (let job = jobQueue.takeAll()[0]; job !== undefined; job = jobQueue.takeAll()[0]) await route(JSON.stringify(job.body as unknown as WidgetRefreshFanoutJob));
    expect(pushSender.silent.flatMap((push) => push.tokens)).toEqual(["token-f1", "token-f2", "token-f3"]);
    expect(audience.scopes.every((scope) => scope === "posts")).toBe(true);
  });

  it("skips users without devices and survives push failures", async () => {
    const { pushSender, deviceTokens, handler } = setup({ value: new Date() });
    expect(await handler.refreshFromEvent(makeEvent("order.paid", { buyerUserId: "nobody" }))).toBe(0);
    await deviceTokens.register("buyer", "token", "ios");
    pushSender.sendSilent = async () => { throw new Error("expo down"); };
    expect(await handler.refreshFromEvent(makeEvent("order.paid", { buyerUserId: "buyer" }, "evt-fail"))).toBe(0);
  });
});
