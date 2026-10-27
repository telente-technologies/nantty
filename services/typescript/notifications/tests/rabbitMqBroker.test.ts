import { describe, expect, it } from "vitest";

import { createDomainEventMessageHandler, createJobMessageHandler } from "../src/jobs/messageRouting.job.js";
import { PoisonMessageError } from "../src/errors/poisonMessage.error.js";
import { RabbitMqMessageBroker } from "../src/integrations/rabbitMqBroker.integration.js";
import { RabbitMqConnection } from "../src/integrations/rabbitMqConnection.integration.js";
import { RabbitMqQueueConsumer } from "../src/integrations/rabbitMqQueueConsumer.integration.js";
import { deliveryAttemptFromHeaders } from "../src/utils/retryTier.util.js";
import { FakeAmqpChannel, FakeAmqpModel, waitUntil } from "./fakes/amqpChannel.fake.js";
import { silentLogger } from "./fakes/testHarness.fake.js";

function connectionWith(...channels: FakeAmqpChannel[]) {
  const model = new FakeAmqpModel(channels);
  return { model, connection: new RabbitMqConnection("amqp://test", "notifications", silentLogger, async () => model, () => 1) };
}

function startConsumer(channels: FakeAmqpChannel[], handle: (body: string) => Promise<void>) {
  const { connection, model } = connectionWith(...channels);
  const consumer = new RabbitMqQueueConsumer(connection, { name: "jobs", queue: "jobs-email", prefetch: 5, handleMessageBody: handle, logger: silentLogger, delayMs: () => 1 });
  consumer.start();
  return { consumer, model };
}

describe("RabbitMQ job publishing", () => {
  it("publishes persistent, confirmed, mandatory jobs to the jobs exchange", async () => {
    const channel = new FakeAmqpChannel();
    const broker = new RabbitMqMessageBroker(connectionWith(channel).connection, 5, silentLogger);
    await broker.send("jobs-email", { type: "bulkSend.batch", campaignId: "c1" });
    const [published] = channel.published;
    expect(published?.exchange).toBe("nantty.jobs");
    expect(published?.routingKey).toBe("jobs-email");
    expect(published?.options).toMatchObject({ mandatory: true, persistent: true, type: "bulkSend.batch", contentType: "application/json" });
    expect(JSON.parse(published?.content ?? "{}")).toEqual({ type: "bulkSend.batch", campaignId: "c1" });
  });

  it("delays jobs through the largest delay queue that fits and sends short delays immediately", async () => {
    const channel = new FakeAmqpChannel();
    const broker = new RabbitMqMessageBroker(connectionWith(channel).connection, 5, silentLogger);
    await broker.send("jobs-email", { type: "email.sendIfUnread" }, 900);
    await broker.send("jobs-email", { type: "email.sendIfUnread" }, 10);
    expect(channel.published.map((entry) => `${entry.exchange}/${entry.routingKey}`)).toEqual(["nantty.retry/jobs-email.retry.10m", "nantty.jobs/jobs-email"]);
  });

  it("fails the send when the broker nacks or cannot route the job", async () => {
    const nacking = new FakeAmqpChannel();
    nacking.nackPublishes = true;
    await expect(new RabbitMqMessageBroker(connectionWith(nacking).connection, 5, silentLogger).send("jobs-email", { type: "x" })).rejects.toThrow("nacked");
    const unroutable = new FakeAmqpChannel();
    unroutable.unroutableKeys.add("jobs-missing");
    await expect(new RabbitMqMessageBroker(connectionWith(unroutable).connection, 5, silentLogger).send("jobs-missing", { type: "x" })).rejects.toThrow("unroutable");
  });
});

describe("RabbitMQ queue consumer", () => {
  it("acknowledges handled messages manually with the configured prefetch", async () => {
    const channel = new FakeAmqpChannel();
    const bodies: string[] = [];
    const { consumer } = startConsumer([channel], async (body) => void bodies.push(body));
    await waitUntil(() => channel.prefetchCount === 5);
    channel.deliver(1, "{\"type\":\"digest.run\"}");
    await waitUntil(() => channel.settled.length === 1);
    expect(channel.settled[0]).toEqual({ tag: 1, outcome: "ack", requeue: false });
    expect(bodies).toEqual(["{\"type\":\"digest.run\"}"]);
    await consumer.stop();
    expect(channel.cancelled).toBe(true);
  });

  it("schedules an exponential retry and acknowledges the original after the retry is confirmed", async () => {
    const channel = new FakeAmqpChannel();
    const { consumer } = startConsumer([channel], async () => { throw new Error("ses throttled"); });
    await waitUntil(() => channel.prefetchCount === 5);
    channel.deliver(1, "{}", { "x-nantty-attempt": 1 });
    await waitUntil(() => channel.settled.length === 1);
    expect(channel.settled[0]?.outcome).toBe("ack");
    const retry = channel.published[0];
    expect(`${retry?.exchange}/${retry?.routingKey}`).toBe("nantty.retry/jobs-email.retry.2m");
    expect(deliveryAttemptFromHeaders(retry?.options.headers as Record<string, unknown>)).toBe(2);
    expect(retry?.options.messageId).toBe("m-1");
    await consumer.stop();
  });

  it("dead-letters after the last attempt and sends poison straight to the dead-letter queue", async () => {
    const channel = new FakeAmqpChannel();
    const { consumer } = startConsumer([channel], async (body) => {
      if (body === "poison") throw new PoisonMessageError("bad");
      throw new Error("still failing");
    });
    await waitUntil(() => channel.prefetchCount === 5);
    channel.deliver(1, "{}", { "x-nantty-attempt": 4 });
    channel.deliver(2, "poison");
    await waitUntil(() => channel.settled.length === 2);
    expect(channel.settled).toEqual([{ tag: 1, outcome: "nack", requeue: false }, { tag: 2, outcome: "nack", requeue: false }]);
    expect(channel.published).toHaveLength(0);
    await consumer.stop();
  });

  it("requeues when the retry cannot be published", async () => {
    const channel = new FakeAmqpChannel();
    channel.nackPublishes = true;
    const { consumer } = startConsumer([channel], async () => { throw new Error("down"); });
    await waitUntil(() => channel.prefetchCount === 5);
    channel.deliver(1, "{}");
    await waitUntil(() => channel.settled.length === 1);
    expect(channel.settled[0]).toEqual({ tag: 1, outcome: "nack", requeue: true });
    await consumer.stop();
  });

  it("opens a new channel when the current one closes", async () => {
    const first = new FakeAmqpChannel();
    const second = new FakeAmqpChannel();
    const { consumer, model } = startConsumer([first, second], async () => undefined);
    await waitUntil(() => first.prefetchCount === 5);
    await first.close();
    await waitUntil(() => second.prefetchCount === 5);
    second.deliver(7, "{}");
    await waitUntil(() => second.settled.length === 1);
    expect(model.opened).toBe(2);
    await consumer.stop();
  });
});

describe("message routing marks undecodable messages as poison", () => {
  const handlers = { handleDomainEvent: { execute: async () => undefined }, processBulkBatch: { execute: async () => undefined }, deliverEmailIfStillUnread: { execute: async () => undefined }, recordSesFeedback: { execute: async () => undefined }, runDigestBatch: null } as never;

  it("rejects garbage, invalid envelopes and unknown job types", async () => {
    await expect(createDomainEventMessageHandler(handlers, silentLogger)("not json")).rejects.toBeInstanceOf(PoisonMessageError);
    await expect(createDomainEventMessageHandler(handlers, silentLogger)("{\"x\":1}")).rejects.toBeInstanceOf(PoisonMessageError);
    await expect(createJobMessageHandler(handlers, silentLogger)("{\"type\":\"unknown\"}")).rejects.toBeInstanceOf(PoisonMessageError);
  });
});
