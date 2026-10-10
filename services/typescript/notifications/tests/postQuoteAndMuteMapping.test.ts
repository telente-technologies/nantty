import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
const actor = { id: "quoter", name: "Ada" };

async function setup(...pushUsers: string[]) {
  const harness = createTestHarness();
  for (const userId of pushUsers) await harness.deviceTokens.register(userId, `ExponentPushToken[${userId}]`, "android");
  return { harness, handler: new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger) };
}

const reshared = (data: Record<string, unknown>, id?: string) =>
  makeEvent("post.reshared", { postId: "p2", originalPostId: "p1", authorId: "quoter", originalAuthorId: "author", isQuote: true, actor, ...data }, id);

describe("quote and repost notifications", () => {
  it("tells the quoted author about post quotes, comment quotes and plain reposts", async () => {
    const { harness, handler } = await setup("author");
    await handler.execute({ event: reshared({ url: "/post/p2" }, "e1") });
    await handler.execute({ event: reshared({ surface: "comment", commentId: "c1", url: "/post/p9?comment=c1" }, "e2") });
    await handler.execute({ event: reshared({ isQuote: false }, "e3") });
    expect(harness.notifications.rows.map((row) => [row.userId, row.body, row.kind, row.data["url"]])).toEqual([
      ["author", "quoted your post.", "quote", "/post/p2"],
      ["author", "quoted your post in a comment.", "quote", "/post/p9?comment=c1"],
      ["author", "reposted your post.", "repost", "/post/p2"],
    ]);
    expect(harness.pushSender.sent).toHaveLength(3);
  });

  it("never notifies you about quoting your own post", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: reshared({ originalAuthorId: "quoter" }) });
    expect(harness.notifications.rows).toHaveLength(0);
  });

  it("skips push when the author turned social pushes off but keeps the inbox row", async () => {
    const { harness, handler } = await setup("author");
    await harness.preferences.upsert("author", "social", { push: false });
    await handler.execute({ event: reshared({}) });
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});

describe("per-post notification mutes", () => {
  const postEvents: readonly [string, Record<string, unknown>][] = [
    ["comment.created", { recipientUserId: "author", actor, commentId: "c1", postId: "p1", target: "post", excerpt: "hi", url: "/post/p1" }],
    ["mention.created", { recipientUserId: "author", actor, surface: "comment", postId: "p1", excerpt: "hi", url: "/post/p1" }],
    ["videoReply.created", { recipientUserId: "author", actor, url: "/clips/x" }],
    ["post.tagged", { recipientUserId: "author", actor, postId: "p1", kind: "post" }],
    ["post.reshared", { postId: "p2", originalPostId: "p1", authorId: "quoter", originalAuthorId: "author", isQuote: true, actor }],
  ];

  it.each(postEvents)("drops %s when social marked the recipient's post as muted", async (type, data) => {
    const { harness, handler } = await setup("author");
    const result = await handler.execute({ event: makeEvent(type, { ...data, notificationsMuted: true }) });
    expect(result).toMatchObject({ handled: true, intents: 0, reason: "post_notifications_muted" });
    expect(harness.notifications.rows).toHaveLength(0);
    expect(harness.pushSender.sent).toHaveLength(0);
  });

  it.each(postEvents)("delivers %s again once unmuted", async (type, data) => {
    const { harness, handler } = await setup("author");
    await handler.execute({ event: makeEvent(type, data) });
    expect(harness.notifications.rows).toHaveLength(1);
  });

  it("still pushes direct messages", async () => {
    const { harness, handler } = await setup("author");
    await handler.execute({ event: makeEvent("message.sent", { conversationId: "dm", messageId: "m1", senderId: "s", kind: "text", recipientIds: ["author"], conversationKind: "direct", senderName: "Ada", pushRecipients: [{ userId: "author", showPreview: true }] }) });
    expect(harness.pushSender.sent).toHaveLength(1);
  });
});
