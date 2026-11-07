import { beforeEach, describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";
import { createTestHarness, makeEvent, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";

const streak = eventFixtures["streak.milestoneReached"]!.data as Record<string, unknown>;
let harness: TestHarness;
let handler: HandleDomainEventHandler;

const handle = (data: Record<string, unknown> = streak, id = "evt-streak-milestone") =>
  handler.execute({ event: makeEvent("streak.milestoneReached", data, id) });

beforeEach(() => {
  harness = createTestHarness();
  harness.identity.add(makeRecipient({ accountId: "u1" }));
  harness.identity.add(makeRecipient({ accountId: "u2" }));
  handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, {
    webBaseUrl: "https://nantty.com",
    sellerDashboardUrl: "https://dashboard.nantty.com",
  }, silentLogger);
});

describe("streak.milestoneReached", () => {
  it("notifies both chat participants and opens their conversation from push", async () => {
    await harness.deviceTokens.register("u1", "ExponentPushToken[streak-u1]", "ios");
    await harness.deviceTokens.register("u2", "ExponentPushToken[streak-u2]", "android");

    expect(await handle()).toMatchObject({ handled: true, intents: 2 });
    expect(harness.notifications.rows).toHaveLength(2);
    expect(harness.notifications.rows.map((row) => [row.userId, row.kind, row.data])).toEqual([
      ["u1", "streakMilestone", { screen: "Chat", conversationId: "0192f0a1-7c3e-7000-8000-00000000c1a4" }],
      ["u2", "streakMilestone", { screen: "Chat", conversationId: "0192f0a1-7c3e-7000-8000-00000000c1a4" }],
    ]);
    expect(harness.pushSender.sent).toHaveLength(2);
    expect(harness.pushSender.sent[0]!.content).toMatchObject({
      title: "7-day chat streak!",
      data: { screen: "Chat", conversationId: "0192f0a1-7c3e-7000-8000-00000000c1a4" },
    });
  });

  it("deduplicates participants and ignores invalid milestone counts", async () => {
    expect(await handle({ ...streak, accountIds: ["u1", "u1", "u2"] }, "evt-streak-dedup")).toMatchObject({ handled: true, intents: 2 });
    expect(harness.notifications.rows).toHaveLength(2);

    expect(await handle({ ...streak, days: 0 }, "evt-streak-invalid")).toMatchObject({ handled: true, intents: 0 });
    expect(harness.notifications.rows).toHaveLength(2);
  });
});
