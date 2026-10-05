import { randomUUID } from "node:crypto";

import type { Logger } from "@zudojs/logger";

import { domainEventsExchange, jobsExchange, retryExchange } from "../constants/rabbitMq.constant.js";
import type { PublishableDomainEvent } from "../interfaces/domainEventPublisher.interface.js";
import type { MessageBroker, QueueConsumer } from "../interfaces/jobQueue.interface.js";
import { delayTierAtMost, retryQueueName } from "../utils/retryTier.util.js";
import { publishConfirmed, type AmqpChannel, type RabbitMqConnection } from "./rabbitMqConnection.integration.js";
import { RabbitMqQueueConsumer } from "./rabbitMqQueueConsumer.integration.js";

export class RabbitMqMessageBroker implements MessageBroker {
  private publishChannel: Promise<AmqpChannel> | undefined;

  public constructor(private readonly connection: RabbitMqConnection, private readonly prefetch: number, private readonly logger: Logger) {}

  public async send(queue: string, body: unknown, delaySeconds = 0): Promise<void> {
    const tier = delayTierAtMost(delaySeconds);
    const [exchange, routingKey] = tier === null ? [jobsExchange, queue] : [retryExchange, retryQueueName(queue, tier)];
    const type = typeof body === "object" && body !== null && typeof (body as { type?: unknown }).type === "string" ? (body as { type: string }).type : "job";
    const channel = await this.channelForPublishing();
    try {
      await publishConfirmed(channel, exchange, routingKey, Buffer.from(JSON.stringify(body)), { messageId: randomUUID(), type, contentType: "application/json", timestamp: Math.floor(Date.now() / 1000) });
    } catch (error) {
      this.publishChannel = undefined;
      await channel.close().catch(() => undefined);
      throw error;
    }
  }

  public async publishDomainEvents(events: readonly PublishableDomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const channel = await this.channelForPublishing();
    try {
      await Promise.all(events.map((event) => publishConfirmed(channel, domainEventsExchange, event.eventType, Buffer.from(JSON.stringify(event.payload)), {
        messageId: event.id, correlationId: event.id, type: event.eventType, contentType: "application/json", timestamp: Math.floor(Date.now() / 1000),
        headers: { "x-zudomart-subject": event.subject, "x-zudomart-schema": "envelope.v1" },
      })));
    } catch (error) {
      this.publishChannel = undefined;
      await channel.close().catch(() => undefined);
      throw error;
    }
  }

  public createConsumer(name: string, queue: string, handleMessageBody: (body: string) => Promise<void>): QueueConsumer {
    return new RabbitMqQueueConsumer(this.connection, { name, queue, prefetch: this.prefetch, handleMessageBody, logger: this.logger });
  }

  public async close(): Promise<void> {
    await this.connection.close();
  }

  private channelForPublishing(): Promise<AmqpChannel> {
    if (this.publishChannel === undefined) {
      const pending = this.connection.openChannel().then((channel) => {
        channel.on("close", () => {
          if (this.publishChannel === pending) this.publishChannel = undefined;
        });
        channel.on("error", () => undefined);
        return channel;
      });
      this.publishChannel = pending;
      pending.catch(() => {
        if (this.publishChannel === pending) this.publishChannel = undefined;
      });
    }
    return this.publishChannel;
  }
}
