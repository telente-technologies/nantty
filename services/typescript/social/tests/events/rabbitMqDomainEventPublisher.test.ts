import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { createRabbitMqDomainEventPublisher, type AmqpPublishChannel, type AmqpPublishConnection } from "../../src/integrations/rabbitMqDomainEventPublisher.integration.js";

class FakeChannel extends EventEmitter {
  public readonly published: { exchange: string; routingKey: string; body: string; options: Record<string, unknown> }[] = [];
  public failConfirms = false;
  public unroutable = new Set<string>();

  public publish(exchange: string, routingKey: string, content: Buffer, options: Record<string, unknown> = {}): boolean {
    this.published.push({ exchange, routingKey, body: content.toString("utf8"), options });
    if (this.unroutable.has(routingKey)) this.emit("return", { properties: { messageId: options["messageId"] } });
    return true;
  }

  public async waitForConfirms(): Promise<void> {
    if (this.failConfirms) throw new Error("nacked");
  }

  public async close(): Promise<void> {}
}

class FakeConnection extends EventEmitter implements AmqpPublishConnection {
  public closed = 0;
  public constructor(private readonly channel: FakeChannel) { super(); }
  public async createConfirmChannel(): Promise<AmqpPublishChannel> { return this.channel as unknown as AmqpPublishChannel; }
  public async close(): Promise<void> { this.closed += 1; }
}

const event = { id: "0190-evt", eventType: "post.created", subject: "post-1", payload: { id: "0190-evt", type: "post.created", data: { postId: "post-1" } } };

describe("RabbitMQ domain event publisher", () => {
  it("publishes the unchanged envelope with the event type as routing key and waits for confirms", async () => {
    const channel = new FakeChannel();
    const publisher = createRabbitMqDomainEventPublisher("amqp://test", async () => new FakeConnection(channel));
    await publisher.publishDomainEvents([event]);
    expect(channel.published[0]).toMatchObject({ exchange: "nantty.events", routingKey: "post.created" });
    expect(channel.published[0]?.options).toMatchObject({ persistent: true, mandatory: true, messageId: "0190-evt", type: "post.created", headers: { "x-nantty-subject": "post-1", "x-nantty-schema": "envelope.v1" } });
    expect(JSON.parse(channel.published[0]?.body ?? "{}")).toEqual(event.payload);
  });

  it("fails the batch so the outbox keeps the rows when the broker nacks or cannot route", async () => {
    const nacking = new FakeChannel();
    nacking.failConfirms = true;
    const connection = new FakeConnection(nacking);
    await expect(createRabbitMqDomainEventPublisher("amqp://test", async () => connection).publishDomainEvents([event])).rejects.toThrow("nacked");
    expect(connection.closed).toBe(1);
    const unroutable = new FakeChannel();
    unroutable.unroutable.add("post.created");
    await expect(createRabbitMqDomainEventPublisher("amqp://test", async () => new FakeConnection(unroutable)).publishDomainEvents([event])).rejects.toThrow("unroutable");
  });
});
