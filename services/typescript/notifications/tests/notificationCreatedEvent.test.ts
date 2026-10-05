import { describe, expect, it } from "vitest";

import { buildNotificationCreatedOutboxRow } from "../src/events/notificationCreated.event.js";
import { RabbitMqMessageBroker } from "../src/integrations/rabbitMqBroker.integration.js";
import { RabbitMqConnection } from "../src/integrations/rabbitMqConnection.integration.js";
import { OutboxRelayJob } from "../src/jobs/outboxRelay.job.js";
import { convertNotificationToResponse, toInAppPath } from "../src/modules/inbox/dtos/notification.dto.js";
import type { StoredNotification } from "../src/interfaces/repositories.interface.js";
import { FakeAmqpChannel, FakeAmqpModel } from "./fakes/amqpChannel.fake.js";
import { silentLogger } from "./fakes/testHarness.fake.js";

const accountId = "7b9e2f3a-1111-4222-8333-123456789abc";
const stored: StoredNotification = {
  id: "n-1", userId: accountId, category: "system", kind: null, title: "We got your request SUP-10421", body: "A member of our support team will reply soon.", actor: null,
  data: { url: "https://zudomart.com/help/tickets/t-1", ticketId: "t-1", screen: "SupportTicketDetail", internalNote: "never exposed" }, readAt: null, createdAt: new Date("2026-10-05T10:00:00.000Z"),
};

describe("notification response", () => {
  it("turns links on the web origin into in-app paths and exposes only link fields", () => {
    expect(convertNotificationToResponse(stored, "https://zudomart.com")).toEqual({
      id: "n-1", category: "system", title: stored.title, body: stored.body, createdAt: "2026-10-05T10:00:00.000Z", read: false, actor: null,
      url: "/help/tickets/t-1", data: { ticketId: "t-1", screen: "SupportTicketDetail" },
    });
  });

  it("drops links to other origins and protocol-relative paths", () => {
    expect(toInAppPath("https://evil.example/help", "https://zudomart.com")).toBeNull();
    expect(toInAppPath("//evil.example/help", "https://zudomart.com")).toBeNull();
    expect(toInAppPath("/orders/o-1")).toBe("/orders/o-1");
    expect(toInAppPath("https://zudomart.com/orders/o-1")).toBeNull();
  });
});

describe("notification.created event", () => {
  it("builds an envelope addressed to the recipient that realtime can route to user:<accountId>", () => {
    const row = buildNotificationCreatedOutboxRow(stored, "https://zudomart.com");
    expect(row.eventType).toBe("notification.created");
    expect(row.subject).toBe(accountId);
    expect(row.payload).toMatchObject({
      id: row.id, type: "notification.created", source: "notifications", schemaVersion: 1, occurredAt: "2026-10-05T10:00:00.000Z",
      data: { accountId, notificationId: "n-1", notification: { id: "n-1", url: "/help/tickets/t-1", data: { ticketId: "t-1" } } },
    });
  });

  it("publishes outbox events to the domain events exchange keyed by type", async () => {
    const channel = new FakeAmqpChannel();
    const connection = new RabbitMqConnection("amqp://test", "notifications", silentLogger, async () => new FakeAmqpModel([channel]), () => 1);
    const broker = new RabbitMqMessageBroker(connection, 5, silentLogger);
    const row = buildNotificationCreatedOutboxRow(stored);
    await broker.publishDomainEvents([{ id: row.id, eventType: row.eventType, subject: row.subject, payload: row.payload }]);
    const [published] = channel.published;
    expect(published?.exchange).toBe("zudomart.events");
    expect(published?.routingKey).toBe("notification.created");
    expect(published?.options).toMatchObject({ messageId: row.id, mandatory: true, persistent: true, headers: { "x-zudomart-schema": "envelope.v1" } });
    expect(JSON.parse(published?.content ?? "{}")).toMatchObject({ type: "notification.created", data: { accountId } });
  });

  it("drains the outbox until a pass relays nothing and survives broker failures", async () => {
    const batches = [2, 1, 0];
    const job = new OutboxRelayJob(async () => batches.shift() ?? 0, silentLogger);
    await job.tick();
    expect(batches).toEqual([]);
    const failing = new OutboxRelayJob(async () => { throw new Error("broker down"); }, silentLogger);
    await expect(failing.tick()).resolves.toBeUndefined();
  });
});
