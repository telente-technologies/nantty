import { beforeEach, describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";
import { createTestHarness, makeEvent, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";

const reminder = eventFixtures["streak.reminderDue"]!.data as Record<string, unknown>;
let harness: TestHarness;
let handler: HandleDomainEventHandler;

const handle = (data: Record<string, unknown> = reminder, id = "evt-streak-reminder") =>
  handler.execute({ event: makeEvent("streak.reminderDue", data, id) });

beforeEach(() => {
  harness = createTestHarness();
  harness.identity.add(makeRecipient({ accountId: "u1" }));
  handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, {
    webBaseUrl: "https://nantty.com",
    sellerDashboardUrl: "https://dashboard.nantty.com",
  }, silentLogger);
});

describe("streak.reminderDue", () => {
  it("creates an inbox reminder and a chat deep-link push for only the due participant", async () => {
    await harness.deviceTokens.register("u1", "ExponentPushToken[streak-expiry-u1]", "ios");

    expect(await handle()).toMatchObject({ handled: true, intents: 1 });
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.notifications.rows[0]).toMatchObject({
      userId: "u1",
      kind: "streakEndingSoon",
      title: "Your 7-day chat streak is ending soon",
      data: { screen: "Chat", conversationId: "0192f0a1-7c3e-7000-8000-00000000c1a4" },
    });
    expect(harness.pushSender.sent[0]?.content.data).toEqual({
      screen: "Chat",
      conversationId: "0192f0a1-7c3e-7000-8000-00000000c1a4",
    });
  });

  it("respects the recipient social push preference and rejects invalid streak counts", async () => {
    await harness.deviceTokens.register("u1", "ExponentPushToken[streak-expiry-u1]", "ios");
    await harness.preferences.upsert("u1", "social", { push: false });
    await handle();
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.pushSender.sent).toHaveLength(0);

    expect(await handle({ ...reminder, count: 0 }, "evt-streak-invalid-count")).toMatchObject({ handled: true, intents: 0 });
    expect(harness.notifications.rows).toHaveLength(1);
  });
});
