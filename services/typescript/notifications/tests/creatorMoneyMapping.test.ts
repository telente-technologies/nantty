import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, runQueuedTemplateEmails, silentLogger } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const creatorId = "c1";

async function setup() {
  const harness = createTestHarness();
  await harness.deviceTokens.register(creatorId, "ExponentPushToken[c1]", "ios");
  return { harness, handler: new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger) };
}

describe("creator money notifications", () => {
  it("tells the creator about a new subscriber with their share", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("creatorSubscription.started", { subscriptionId: "s1", creatorId, subscriberId: "u9", creatorShare: { amountMinor: 160000, currency: "NGN" }, kind: "initial" }) });
    expect(harness.notifications.rows).toEqual([expect.objectContaining({ userId: creatorId, title: "New subscriber", category: "system" })]);
    expect(harness.notifications.rows[0]?.body).toContain("1,600");
  });

  it("notifies the tipped creator and the creator credited with an affiliate commission", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("tip.sent", { tipId: "t1", senderUserId: "u9", creatorUserId: creatorId, targetType: "clip", targetId: "x", coins: 50, creatorCoins: 35 }) });
    await handler.execute({ event: makeEvent("affiliateCommission.credited", { commissionId: "a1", creatorId, orderId: "o1", productId: "p1", storeId: "s1", commission: { amountMinor: 25000, currency: "NGN" } }) });
    expect(harness.notifications.rows.map((row) => [row.title, row.body])).toEqual([
      ["You got a tip", "Someone tipped 50 coins on your clip."],
      ["Affiliate commission earned", expect.stringContaining("250")],
    ]);
    expect(harness.notifications.rows.every((row) => row.userId === creatorId && row.data["url"] === "/creator")).toBe(true);
    expect(harness.pushSender.sent.map((push) => push.content.title)).toEqual(["You got a tip", "Affiliate commission earned"]);
  });

  it("notifies a Space host only after the committed gift credits creator earnings", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("spaceCoinGift.committed", { spaceCoinGiftId: "g1", spaceId: "sp1", giftId: "gift1", quantity: 1, totalCoins: 100, creatorAmountCoins: 60, senderUserId: "u9", hostUserId: creatorId }) });
    expect(harness.notifications.rows).toEqual([
      expect.objectContaining({ userId: creatorId, title: "Space gift credited", body: "60 coins from a Space gift were credited to your creator earnings." }),
    ]);
    expect(harness.pushSender.sent.map((push) => push.content.title)).toEqual(["Space gift credited"]);
  });

  it("respects the creator push preference", async () => {
    const { harness, handler } = await setup();
    await harness.preferences.upsert(creatorId, "creator", { push: false });
    await handler.execute({ event: makeEvent("tip.sent", { tipId: "t2", senderUserId: "u9", creatorUserId: creatorId, targetType: "post", targetId: "x", coins: 5 }) });
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});

describe("ad account invites", () => {
  it("emails and notifies the invitee with the invite link, and ignores links that are not https", async () => {
    const harness = createTestHarness();
    harness.identity.accounts.set("u1", makeRecipient({ accountId: "u1", email: "amaka@example.com" }));
    const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger);
    const data = { inviteId: "i1", accountId: "acc1", accountName: "Ada's Closet", role: "advertiser", invitedBy: "Adaeze", invitedByUserId: "u2", inviteeUserId: "u1", expiresAt: "2026-10-12T09:00:00.000Z", inviteUrl: "https://ads.nantty.com/invites/i1" };
    await handler.execute({ event: makeEvent("adInvite.created", data) });
    await runQueuedTemplateEmails(harness);
    expect(harness.notifications.rows).toEqual([expect.objectContaining({ userId: "u1", title: "Ad account invite" })]);
    expect(harness.sender.sent[0]).toMatchObject({ to: "amaka@example.com", subject: "Adaeze invited you to Ada's Closet on Nantty Ads" });
    expect(harness.sender.sent[0]?.html).toContain("https://ads.nantty.com/invites/i1");
    await handler.execute({ event: makeEvent("adInvite.created", { ...data, inviteUrl: "javascript:alert(1)" }, "evt-2") });
    await runQueuedTemplateEmails(harness);
    expect(harness.sender.sent).toHaveLength(1);
  });
});

describe("account push switch", () => {
  it("keeps the in-app notification but sends no push when the account turned push off", async () => {
    const { harness, handler } = await setup();
    harness.identity.accounts.set(creatorId, makeRecipient({ accountId: creatorId, pushEnabled: false }));
    await handler.execute({ event: makeEvent("tip.sent", { tipId: "t3", senderUserId: "u9", creatorUserId: creatorId, targetType: "post", targetId: "x", coins: 5 }) });
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});
