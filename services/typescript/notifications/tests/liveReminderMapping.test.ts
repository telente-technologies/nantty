import { beforeEach, describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";
import { createTestHarness, makeEvent, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const reminder = eventFixtures["live.reminderDue"]!.data as Record<string, unknown>;
let harness: TestHarness;
let handler: HandleDomainEventHandler;

const handle = (data: Record<string, unknown> = reminder, id = "evt-reminder") => handler.execute({ event: { ...makeEvent("live.reminderDue", data, id), occurredAt: "2026-10-12T17:45:00.000Z" } });

beforeEach(() => {
  harness = createTestHarness();
  harness.identity.add(makeRecipient({ accountId: "u1" }));
  harness.identity.add(makeRecipient({ accountId: "u2" }));
  handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger);
});

describe("live.reminderDue", () => {
  it("delivers one in-app and one push reminder per follower, once per event", async () => {
    await harness.deviceTokens.register("u1", "ExponentPushToken[reminder-u1]", "ios");
    await harness.deviceTokens.register("u2", "ExponentPushToken[reminder-u2]", "android");
    expect(await handle()).toMatchObject({ handled: true, intents: 2 });
    await handle();
    expect(harness.notifications.rows).toHaveLength(2);
    expect(harness.pushSender.sent).toHaveLength(2);
    const push = harness.pushSender.sent[0]!.content;
    expect(push.title).toBe("Adaeze goes live in 15 minutes");
    expect(push.body).toBe("Sunday pottery");
    expect(push.data).toMatchObject({ liveId: "l2", url: "/live/l2" });
    expect(harness.sender.sent).toHaveLength(0);
  });

  it("respects a follower who turned off live push", async () => {
    await harness.deviceTokens.register("u1", "ExponentPushToken[reminder-u1]", "ios");
    await harness.preferences.upsert("u1", "live", { push: false });
    await handle({ ...reminder, notifyUserIds: ["u1"] });
    expect(harness.pushSender.sent).toHaveLength(0);
    expect(harness.notifications.rows).toHaveLength(1);
  });

  it("says any minute now when the reminder arrives late and alerts nobody without recipients", async () => {
    await handle({ ...reminder, notifyUserIds: ["u1"], scheduledAt: "2026-10-12T17:40:00.000Z" }, "evt-late");
    expect(JSON.stringify(harness.notifications.rows[0])).toContain("goes live any minute now: Sunday pottery");
    expect(await handle({ ...reminder, notifyUserIds: [] }, "evt-empty")).toMatchObject({ handled: true, intents: 0 });
  });

  it("drops a payload without a live id instead of notifying with a broken link", async () => {
    const { liveId: _dropped, ...withoutLive } = reminder;
    expect(await handle(withoutLive, "evt-broken")).toMatchObject({ handled: false, reason: "incomplete_event_data" });
    expect(harness.notifications.rows).toHaveLength(0);
  });
});
