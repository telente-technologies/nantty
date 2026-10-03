import { beforeEach, describe, expect, it } from "vitest";

import { DeliverEmailIfStillUnreadHandler } from "../src/modules/delivery/commands/deliverEmailIfStillUnread/deliverEmailIfStillUnread.handler.js";
import { GetUnreadCountHandler } from "../src/modules/inbox/queries/getUnreadCount/getUnreadCount.handler.js";
import { ListNotificationPreferencesHandler } from "../src/modules/inbox/queries/listNotificationPreferences/listNotificationPreferences.handler.js";
import { ListNotificationsHandler } from "../src/modules/inbox/queries/listNotifications/listNotifications.handler.js";
import { MarkAllNotificationsReadHandler } from "../src/modules/inbox/commands/markAllNotificationsRead/markAllNotificationsRead.handler.js";
import { MarkNotificationReadHandler } from "../src/modules/inbox/commands/markNotificationRead/markNotificationRead.handler.js";
import { UpdateNotificationPreferenceHandler } from "../src/modules/inbox/commands/updateNotificationPreference/updateNotificationPreference.handler.js";
import { CreateDraftFromPublishedPolicyHandler } from "../src/modules/noticeDrafts/commands/createDraftFromPublishedPolicy/createDraftFromPublishedPolicy.handler.js";
import { SendNoticeTestEmailHandler } from "../src/modules/noticeDrafts/commands/sendNoticeTestEmail/sendNoticeTestEmail.handler.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { createTestHarness, makeEvent, type TestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

let harness: TestHarness;
beforeEach(() => { harness = createTestHarness(); });

async function seedInbox() {
  const intents = [
    { kind: undefined, key: "1", title: "Order shipped" }, { kind: "mention" as const, key: "2", title: "Adaeze Okafor" }, { kind: undefined, key: "3", title: "Welcome" },
  ];
  for (const intent of intents) {
    await harness.notifications.insertIfAbsent({ userId: "u1", dedupeKey: intent.key, category: intent.kind === "mention" ? "social" : "orders", kind: intent.kind ?? null, templateKey: null, title: intent.title, body: "body", actor: null, data: {} });
  }
}

describe("inbox", () => {
  it("lists newest first with the All and Mentions filters and an unread count", async () => {
    await seedInbox();
    const list = new ListNotificationsHandler(harness.notifications);
    const all = await list.execute({ userId: "u1", filter: "all", limit: 2, cursor: null });
    expect(all.data.map((item) => item.title)).toEqual(["Welcome", "Adaeze Okafor"]);
    expect(all.nextCursor).not.toBeNull();
    const next = await list.execute({ userId: "u1", filter: "all", limit: 2, cursor: all.nextCursor });
    expect(next).toMatchObject({ data: [{ title: "Order shipped", read: false }], nextCursor: null });
    const mentions = await list.execute({ userId: "u1", filter: "mentions", limit: 30, cursor: null });
    expect(mentions.data.map((item) => item.kind)).toEqual(["mention"]);
    expect(await new GetUnreadCountHandler(harness.notifications).execute({ userId: "u1" })).toEqual({ count: 3 });
  });

  it("marks one or all as read and never touches another user's notification", async () => {
    await seedInbox();
    const first = harness.notifications.rows[0]!;
    const markRead = new MarkNotificationReadHandler(harness.notifications, harness.now);
    await expect(markRead.execute({ userId: "someone-else", notificationId: first.id })).rejects.toMatchObject({ status: 404 });
    await markRead.execute({ userId: "u1", notificationId: first.id });
    expect(await harness.notifications.countUnread("u1")).toBe(2);
    await new MarkAllNotificationsReadHandler(harness.notifications, harness.now).execute({ userId: "u1" });
    expect(await harness.notifications.countUnread("u1")).toBe(0);
  });

  it("returns defaults, stores changes, and refuses to mute security categories", async () => {
    const update = new UpdateNotificationPreferenceHandler(harness.preferences);
    await update.execute({ userId: "u1", category: "orders", email: false });
    await expect(update.execute({ userId: "u1", category: "auth", email: false })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const { data } = await new ListNotificationPreferencesHandler(harness.preferences).execute({ userId: "u1" });
    expect(data.find((row) => row.category === "orders")).toMatchObject({ email: false, push: true, locked: false });
    expect(data.find((row) => row.category === "auth")).toMatchObject({ email: true, push: true, locked: true });
    expect(data.find((row) => row.category === "marketing")).toMatchObject({ email: true, push: false });
  });
});

describe("deferred mention email", () => {
  const command = { eventId: "e1", userId: "u1", preferenceCategory: "social" as const, notificationKey: "e1:u1:main", emailDedupeKey: "e1:u1:email:main", templateKey: "mentionedYou" as const, props: {}, notBefore: "2026-10-03T13:00:00.000Z" };
  const createHandler = () => new DeliverEmailIfStillUnreadHandler({ notifications: harness.notifications, deliveries: harness.deliveries, identity: harness.identity, emailDelivery: harness.emailDelivery, jobQueue: harness.jobQueue, jobsQueueUrl: "jobs-queue", now: harness.now });

  beforeEach(async () => {
    harness.identity.add(makeRecipient());
    await harness.notifications.insertIfAbsent({ userId: "u1", dedupeKey: "e1:u1:main", category: "social", kind: "mention", templateKey: null, title: "A", body: "b", actor: null, data: {} });
  });

  it("re-queues itself in at most 15 minute hops until the hour has passed", async () => {
    expect(await createHandler().execute(command)).toBe("waiting");
    expect(harness.jobQueue.jobs[0]?.delaySeconds).toBe(900);
  });

  it("skips the email when the notification was read in the app", async () => {
    harness.clock.current = new Date("2026-10-03T13:01:00.000Z");
    await harness.notifications.markRead("u1", harness.notifications.rows[0]!.id, harness.now());
    expect(await createHandler().execute(command)).toBe("read_in_app");
    expect(harness.sender.sent).toHaveLength(0);
  });

  it("sends the email when it is still unread after the hour", async () => {
    harness.clock.current = new Date("2026-10-03T13:01:00.000Z");
    const data = eventFixtures["mention.created"]!.data;
    const props = { firstName: "Amaka", actorName: "Adaeze", actorHandle: "adaeze", where: "comment" as const, excerpt: String(data["excerpt"]), url: String(data["url"]) };
    expect(await createHandler().execute({ ...command, props })).toBe("delivered");
    expect(harness.sender.sent).toHaveLength(1);
    expect(await createHandler().execute({ ...command, props })).toBe("delivered");
    expect(harness.sender.sent).toHaveLength(1);
  });
});

describe("policy publication", () => {
  const publish = (id = "evt-policy") => makeEvent("policyVersion.published", { kind: "terms", version: "7", effectiveAt: "2026-11-03T00:00:00.000Z", publishedBy: "Legal Lead", versionId: "terms:7", changeSummary: "We clarified escrow release.", whatChanged: ["Escrow release timing"] }, id);
  const createHandler = (autoSend: boolean, queued: unknown[]) => new CreateDraftFromPublishedPolicyHandler(harness.drafts, "https://zudomart.com", autoSend, { execute: async (command) => void queued.push(command) as never });

  it("creates the notice draft once and does not send automatically by default", async () => {
    const queued: unknown[] = [];
    await createHandler(false, queued).handlePolicyPublished({ event: publish() });
    await createHandler(false, queued).handlePolicyPublished({ event: publish("evt-policy-2") });
    expect(harness.drafts.rows.size).toBe(1);
    expect(harness.drafts.rows.get("terms:7")).toMatchObject({ documentTitle: "Terms of Service", subject: "We've updated our Terms of Service", requiresReacceptance: true, documentUrl: "https://zudomart.com/terms" });
    expect(queued).toHaveLength(0);
  });

  it("queues the notice when automatic sending is switched on", async () => {
    const queued: unknown[] = [];
    await createHandler(true, queued).handlePolicyPublished({ event: publish() });
    expect(queued).toHaveLength(1);
  });

  it("sends the draft as a test to the calling admin's own address and records it", async () => {
    await createHandler(false, []).handlePolicyPublished({ event: publish() });
    harness.identity.staffEmails.set("staff1", "legal@zudomart.com");
    const handler = new SendNoticeTestEmailHandler({ drafts: harness.drafts, identity: harness.identity, sender: harness.sender, acceptUrl: "https://zudomart.com/settings/legal/accept", brand: undefined as never, now: harness.now });
    const draft = await handler.execute({ versionId: "terms:7", actor: { id: "staff1", name: "Legal Lead" } });
    expect(harness.sender.sent).toHaveLength(1);
    expect(harness.sender.sent[0]).toMatchObject({ to: "legal@zudomart.com" });
    expect(harness.sender.sent[0]?.subject).toContain("[Test]");
    expect(draft.testSends[0]).toMatchObject({ sentToEmail: "legal@zudomart.com", sentByName: "Legal Lead" });
  });
});
