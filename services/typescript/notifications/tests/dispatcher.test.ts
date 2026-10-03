import { beforeEach, describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { createTestHarness, makeEvent, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };
let harness: TestHarness;
let handler: HandleDomainEventHandler;

beforeEach(() => {
  harness = createTestHarness();
  harness.identity.add(makeRecipient({ accountId: "u1" }));
  harness.identity.add(makeRecipient({ accountId: "u2", email: "u2@example.com", firstName: "Bisola" }));
  harness.identity.add(makeRecipient({ accountId: "buyer1", email: "buyer@example.com", firstName: "Bisola" }));
  harness.identity.add(makeRecipient({ accountId: "seller1", email: "seller@example.com", firstName: "Zainab" }));
  handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger);
});

const handle = (type: string, data = eventFixtures[type]!.data, id = `evt-${type}`) => handler.execute({ event: makeEvent(type, data, id) });

describe("idempotency by event id", () => {
  it("creates one in-app notification and one email when the same event is delivered twice", async () => {
    await handle("account.registered");
    await handle("account.registered");
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.sender.sent).toHaveLength(1);
  });

  it("treats a different event id as a new event", async () => {
    await handle("account.passwordChanged", undefined, "evt-a");
    await handle("account.passwordChanged", undefined, "evt-b");
    expect(harness.sender.sent).toHaveLength(2);
  });

  it("retries a failed send without duplicating the in-app notification", async () => {
    harness.sender.failNext = true;
    await expect(handle("account.passwordChanged")).rejects.toThrow("SES unavailable");
    await handle("account.passwordChanged");
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.sender.sent).toHaveLength(1);
  });

  it("sends each party of a dispute their own email once", async () => {
    await handle("dispute.opened");
    await handle("dispute.opened");
    expect(harness.sender.sent.map((email) => email.to).sort()).toEqual(["buyer@example.com", "seller@example.com"]);
  });
});

describe("recipient address", () => {
  it("always comes from goIdentity, not the event", async () => {
    await handle("account.registered", { ...eventFixtures["account.registered"]!.data, email: "attacker@example.com" });
    expect(harness.sender.sent[0]?.to).toBe("amaka@example.com");
  });

  it("uses the destination only for a one-time code to an address being verified", async () => {
    await handle("otp.issued");
    expect(harness.sender.sent[0]?.to).toBe("new@example.com");
    expect(harness.notifications.rows).toHaveLength(0);
    expect(JSON.stringify([...harness.deliveries.rows.values()])).not.toContain("482913");
  });

  it("skips email but keeps the in-app notification when the account is unknown", async () => {
    await handle("account.registered", { ...eventFixtures["account.registered"]!.data, accountId: "ghost" });
    expect(harness.sender.sent).toHaveLength(0);
    expect(harness.notifications.rows).toHaveLength(1);
  });

  it("does not email an unverified address", async () => {
    harness.identity.add(makeRecipient({ accountId: "u1", emailVerified: false }));
    await handle("account.passwordChanged");
    expect(harness.sender.sent).toHaveLength(0);
    expect([...harness.deliveries.rows.values()].find((row) => row.channel === "email")?.skipReason).toBe("email_not_verified");
  });
});

describe("suppression", () => {
  it("does not email a hard-bounced address, even for security mail", async () => {
    harness.suppressions.rows.set("amaka@example.com", "hard_bounce");
    await handle("account.passwordChanged");
    expect(harness.sender.sent).toHaveLength(0);
    expect(harness.notifications.rows).toHaveLength(1);
  });

  it("still sends transactional mail after a complaint", async () => {
    harness.suppressions.rows.set("amaka@example.com", "complaint");
    await handle("account.registered");
    expect(harness.sender.sent).toHaveLength(1);
  });
});

describe("preferences and incomplete data", () => {
  it("respects a turned-off email preference for transactional mail", async () => {
    await harness.preferences.upsert("buyer1", "orders", { email: false });
    await handle("order.shipped");
    expect(harness.sender.sent).toHaveLength(0);
    expect(harness.notifications.rows).toHaveLength(1);
  });

  it("cannot turn off security mail through preferences", async () => {
    await harness.preferences.upsert("u1", "auth", { email: false });
    await handle("signIn.newDeviceDetected");
    expect(harness.sender.sent).toHaveLength(1);
  });

  it("keeps the in-app notification when optional email data is missing", async () => {
    const { releaseRule: _omitted, ...data } = eventFixtures["escrow.held"]!.data;
    const result = await handle("escrow.held", data);
    expect(result.handled).toBe(true);
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.sender.sent).toHaveLength(0);
  });

  it("drops an event whose core fields are missing", async () => {
    const result = await handle("order.placed", { orderNumber: "ZM-1" });
    expect(result).toMatchObject({ handled: false, reason: "incomplete_event_data" });
  });

  it("ignores event types it does not know", async () => {
    expect(await handle("catalog.productIndexed", {})).toMatchObject({ handled: false, reason: "unhandled_event_type" });
  });
});

describe("push", () => {
  it("sends to registered device tokens and respects the push preference", async () => {
    await harness.deviceTokens.register("buyer1", "ExponentPushToken[abcdefghij]", "ios");
    await handle("order.shipped");
    expect(harness.pushSender.sent).toHaveLength(1);
    await harness.preferences.upsert("buyer1", "orders", { push: false });
    await handle("order.delivered");
    expect(harness.pushSender.sent).toHaveLength(1);
  });
});

describe("mention emails", () => {
  it("defers the email until the notification is still unread after an hour", async () => {
    await handle("mention.created");
    expect(harness.sender.sent).toHaveLength(0);
    expect(harness.notifications.rows[0]?.kind).toBe("mention");
    expect(harness.jobQueue.jobs).toHaveLength(1);
    expect(harness.jobQueue.jobs[0]?.body["type"]).toBe("email.sendIfUnread");
    expect(harness.jobQueue.jobs[0]?.delaySeconds).toBe(900);
  });
});
