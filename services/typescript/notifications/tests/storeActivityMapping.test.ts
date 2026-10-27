import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };

async function setup(...pushUsers: string[]) {
  const harness = createTestHarness();
  for (const userId of pushUsers) await harness.deviceTokens.register(userId, `ExponentPushToken[${userId}]`, "android");
  return { harness, handler: new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger) };
}

describe("store review and application notifications", () => {
  it("tells the store owner about a new review and the buyer about the first seller reply only", async () => {
    const { harness, handler } = await setup("owner", "buyer");
    await handler.execute({ event: makeEvent("review.created", { reviewId: "r1", storeId: "s1", rating: 4, authorAccountId: "buyer", storeOwnerAccountId: "owner", storeName: "Ada Fabrics" }) });
    await handler.execute({ event: makeEvent("review.replied", { reviewId: "r1", storeId: "s1", productId: "p1", authorAccountId: "buyer", storeName: "Ada Fabrics", firstReply: true }) });
    await handler.execute({ event: makeEvent("review.replied", { reviewId: "r1", storeId: "s1", authorAccountId: "buyer", storeName: "Ada Fabrics", firstReply: false }, "evt-edit") });
    expect(harness.notifications.rows.map((row) => [row.userId, row.title, row.body])).toEqual([
      ["owner", "New review", "A buyer left a 4-star review on Ada Fabrics."],
      ["buyer", "The seller replied to your review", "Ada Fabrics replied to your review."],
    ]);
    expect(harness.notifications.rows[0]?.data["url"]).toBe("https://dashboard.nantty.com/reviews");
    expect(harness.notifications.rows[1]?.data["url"]).toBe("/products/p1");
  });

  it("drops a review event without a recipient instead of guessing", async () => {
    const { harness, handler } = await setup();
    const result = await handler.execute({ event: makeEvent("review.created", { reviewId: "r2", storeId: "s1", rating: 5 }) });
    expect(result).toMatchObject({ handled: false, reason: "incomplete_event_data" });
    expect(harness.notifications.rows).toHaveLength(0);
  });

  it("tells the applicant whether the store was approved", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("sellerApplication.reviewed", { applicationId: "a1", accountId: "u1", decision: "approved", storeName: "Ada Fabrics" }) });
    await handler.execute({ event: makeEvent("sellerApplication.reviewed", { applicationId: "a2", accountId: "u2", decision: "rejected", storeName: "Bad Shop", reason: "Documents were unreadable." }) });
    expect(harness.notifications.rows.map((row) => [row.userId, row.title])).toEqual([["u1", "Your store is approved"], ["u2", "Your seller application was not approved"]]);
    expect(harness.notifications.rows[1]?.body).toContain("Documents were unreadable.");
  });

  it("tells a creator when their standing changes", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("creator.standingChanged", { userId: "c1", status: "suspended", reason: "Fake engagement" }) });
    await handler.execute({ event: makeEvent("creator.standingChanged", { userId: "c1", status: "approved" }, "evt-2") });
    expect(harness.notifications.rows.map((row) => row.title)).toEqual(["Your creator account is suspended", "Your creator account is active again"]);
  });
});

describe("chat message pushes", () => {
  it("pushes without message content, only to the recipients social selected, hiding the sender when previews are off", async () => {
    const { harness, handler } = await setup("a", "b", "muted");
    await handler.execute({ event: makeEvent("message.sent", {
      conversationId: "c1", messageId: "m1", senderId: "s", kind: "text", recipientIds: ["a", "b", "muted"], conversationKind: "group", conversationTitle: "Fabric lovers", senderName: "Ada",
      pushRecipients: [{ userId: "a", showPreview: true }, { userId: "b", showPreview: false }],
    }) });
    expect(harness.notifications.rows).toHaveLength(0);
    expect(harness.pushSender.sent.map((push) => [push.tokens[0], push.content.title, push.content.body])).toEqual([
      ["ExponentPushToken[a]", "Fabric lovers", "Ada sent a message"],
      ["ExponentPushToken[b]", "Nantty", "New message"],
    ]);
    expect(harness.pushSender.sent[0]?.content.data).toEqual({ url: "/chats/c1", conversationId: "c1" });
  });

  it("names the sender in a direct chat and ignores events without a push list", async () => {
    const { harness, handler } = await setup("a");
    await handler.execute({ event: makeEvent("message.sent", { conversationId: "c2", conversationKind: "direct", senderName: "Ada", pushRecipients: [{ userId: "a", showPreview: true }] }) });
    await handler.execute({ event: makeEvent("message.sent", { conversationId: "c3", recipientIds: ["a"] }, "evt-old") });
    expect(harness.pushSender.sent.map((push) => [push.content.title, push.content.body])).toEqual([["Ada", "Sent you a message"]]);
  });
});
