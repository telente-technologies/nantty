import { testOtpKey } from "./fixtures/eventFixtures.fixture.js";
import { beforeEach, describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { createTestHarness, makeEvent, runQueuedTemplateEmails, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";
import { DeliverTemplateEmailHandler } from "../src/modules/delivery/commands/deliverTemplateEmail/deliverTemplateEmail.handler.js";
import { SupportInboxAlertService } from "../src/modules/delivery/services/supportInboxAlert.service.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com", otpEnvelopeKeys: { "otp-1": testOtpKey } };
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

const handle = async (type: string, data = eventFixtures[type]!.data, id = `evt-${type}`) => {
  const result = await handler.execute({ event: makeEvent(type, data, id) });
  await runQueuedTemplateEmails(harness);
  return result;
};

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

  it("keeps order/event processing successful and schedules a bounded retry when email delivery fails", async () => {
    harness.sender.failNext = true;
    await expect(handle("account.passwordChanged")).resolves.toMatchObject({ handled: true });
    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.sender.sent).toHaveLength(0);
    expect(harness.jobQueue.jobs).toHaveLength(1);
    expect(harness.jobQueue.jobs[0]).toMatchObject({ delaySeconds: 30, body: { type: "email.deliverTemplate", attempt: 2 } });
  });

  it("notifies the configured support inbox after the fourth failed send", async () => {
    await handler.execute({ event: makeEvent("account.passwordChanged", eventFixtures["account.passwordChanged"]!.data) });
    for (const delaySeconds of [30, 120, 600]) {
      harness.sender.failNext = true;
      await runQueuedTemplateEmails(harness);
      expect(harness.jobQueue.jobs[0]?.delaySeconds).toBe(delaySeconds);
    }
    harness.sender.failNext = true;
    await runQueuedTemplateEmails(harness);
    expect(harness.sender.sent.map((email) => email.to)).toEqual(["support@nantty.test"]);
    expect(harness.sender.sent[0]?.subject).toContain("Transactional email failed");
    expect(await harness.deliveries.listFailedEmails(10)).toEqual([expect.objectContaining({ attemptCount: 4 })]);
  });

  it("retries the terminal admin-alert enqueue when the failed email job is redelivered", async () => {
    const delivery = { dedupeKey: "evt-terminal:email:u1:passwordChanged", eventId: "evt-terminal", userId: "u1", channel: "email" as const, templateKey: "passwordChanged" as const, mailKind: "transactional" as const };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const claim = await harness.deliveries.claim(delivery);
      await harness.deliveries.finish(claim.id, "failed", { skipReason: "email_provider_send_failed" });
    }
    const supportInbox = new SupportInboxAlertService({
      emailDelivery: harness.emailDelivery,
      recipients: ["support@nantty.test"],
      adminBaseUrl: "https://admin.nantty.test",
      jobQueue: harness.jobQueue,
      jobsQueueUrl: "jobs-queue",
    });
    const deliveryHandler = new DeliverTemplateEmailHandler({
      identity: harness.identity,
      emailDelivery: harness.emailDelivery,
      jobQueue: harness.jobQueue,
      jobsQueueUrl: "jobs-queue",
      supportInbox,
      logger: silentLogger,
    });
    const command = { ...delivery, preferenceCategory: "auth" as const, props: {}, attempt: 4 };

    harness.jobQueue.failNext = true;
    await expect(deliveryHandler.execute(command)).rejects.toThrow("queue unavailable");
    expect(harness.jobQueue.jobs).toHaveLength(0);

    await expect(deliveryHandler.execute(command)).resolves.toBe("failed_terminal");
    expect(harness.jobQueue.jobs[0]).toMatchObject({ body: { type: "email.alertDeliveryFailure", eventId: "evt-terminal", address: "support@nantty.test" } });
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

  it("rechecks explicit marketing consent at push dispatch time", async () => {
    harness.identity.add(makeRecipient({ accountId: "u1", marketingConsent: false, pushEnabled: true }));
    await harness.preferences.upsert("u1", "marketing", { push: true });
    await harness.deviceTokens.register("u1", "ExponentPushToken[marketing-device]", "ios");

    const outcome = await harness.dispatcher.dispatch({
      eventId: "reengagement-consent-race",
      recipientUserId: "u1",
      preferenceCategory: "marketing",
      push: { title: "Come back", body: "Explore when you are ready." },
    });

    expect(outcome.push).toBe("skipped:marketing_consent_required");
    expect(harness.pushSender.sent).toHaveLength(0);
    expect([...harness.deliveries.rows.values()].filter((row) => row.channel === "push")).toHaveLength(0);
  });

  it("groups registrations by provider while preserving Expo as the omitted-provider default", async () => {
    await harness.deviceTokens.register("buyer1", "ExponentPushToken[expo-device-token]", "ios");
    await harness.deviceTokens.register("buyer1", "fcm-device-registration-token", "android", "fcm");

    await handle("order.shipped");

    expect(harness.pushSender.providers).toEqual(["expo", "fcm"]);
    expect(harness.pushSender.sent.map((entry) => entry.tokens)).toEqual([
      ["ExponentPushToken[expo-device-token]"],
      ["fcm-device-registration-token"],
    ]);
  });

  it("prunes only permanent unregistered Expo tokens and records token-safe failure diagnostics", async () => {
    const invalidToken = "ExponentPushToken[invalid-device-token]";
    const healthyToken = "ExponentPushToken[healthy-device-token]";
    await harness.deviceTokens.register("buyer1", invalidToken, "ios");
    await harness.deviceTokens.register("buyer1", healthyToken, "android");
    harness.pushSender.nextResult = {
      acceptedCount: 1,
      failures: [{ token: invalidToken, classification: "permanent", code: "DeviceNotRegistered" }],
    };

    await handle("order.shipped");

    expect(await harness.deviceTokens.listTokens("buyer1")).toEqual([healthyToken]);
    const failed = await harness.deliveries.listFailedPushes(10);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ eventId: "evt-order.shipped", reason: "push_provider_failure:expo:permanent:DeviceNotRegistered:1" });
    expect(JSON.stringify(failed)).not.toContain("buyer1");
    expect(JSON.stringify(failed)).not.toContain("ExponentPushToken");
  });

  it("prunes only FCM UNREGISTERED tokens, not other permanent FCM errors", async () => {
    const stale = "stale-fcm-registration-token";
    await harness.deviceTokens.register("buyer1", stale, "android", "fcm");
    harness.pushSender.nextResult = { acceptedCount: 0, failures: [{ token: stale, classification: "permanent", code: "UNREGISTERED" }] };

    await handle("order.shipped");

    expect(await harness.deviceTokens.listTokens("buyer1")).toEqual([]);
    expect((await harness.deliveries.listFailedPushes(10))[0]?.reason).toBe("push_provider_failure:fcm:permanent:UNREGISTERED:1");
  });

  it("does not send or create failed-delivery records when the recipient opted out", async () => {
    await harness.deviceTokens.register("buyer1", "ExponentPushToken[abcdefghij]", "ios");
    await harness.preferences.upsert("buyer1", "orders", { push: false });

    await handle("order.shipped");

    expect(harness.pushSender.sent).toHaveLength(0);
    expect(await harness.deliveries.listFailedPushes(10)).toEqual([]);
  });

  it("records log-adapter pushes as skipped rather than delivered", async () => {
    await harness.deviceTokens.register("buyer1", "ExponentPushToken[log-only-token]", "ios");
    harness.pushSender.nextResult = { acceptedCount: 0, failures: [], simulated: true };

    await handle("order.shipped");

    expect([...harness.deliveries.rows.values()].filter((row) => row.channel === "push")).toMatchObject([
      { status: "skipped", skipReason: "push_provider_log_only" },
    ]);
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
