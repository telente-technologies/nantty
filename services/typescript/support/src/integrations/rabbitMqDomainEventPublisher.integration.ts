import { connect, type ConfirmChannel } from "amqplib";

import type { DomainEventPublisher, PublishableDomainEvent } from "../interfaces/domainEventPublisher.interface.js";

export const domainEventsExchange = "nantty.events";

export type AmqpPublishChannel = Pick<ConfirmChannel, "publish" | "waitForConfirms" | "on" | "close">;

export interface AmqpPublishConnection {
  createConfirmChannel(): Promise<AmqpPublishChannel>;
  close(): Promise<void>;
  on(event: "close" | "error", listener: (error?: Error) => void): unknown;
}

export type AmqpConnect = (url: string) => Promise<AmqpPublishConnection>;

const connectToRabbitMq: AmqpConnect = (url) => connect(url, { clientProperties: { connection_name: "support" } });

export interface ClosableDomainEventPublisher extends DomainEventPublisher {
  close(): Promise<void>;
}

export function createRabbitMqDomainEventPublisher(url: string, connectFn: AmqpConnect = connectToRabbitMq): ClosableDomainEventPublisher {
  let connection: Promise<AmqpPublishConnection> | undefined;
  let channel: Promise<AmqpPublishChannel> | undefined;
  const returned = new Set<string>();

  const reset = async () => {
    const current = connection;
    connection = undefined;
    channel = undefined;
    await current?.then((open) => open.close()).catch(() => undefined);
  };

  const openChannel = (): Promise<AmqpPublishChannel> => {
    connection ??= connectFn(url).then((open) => {
      open.on("error", () => undefined);
      open.on("close", () => {
        connection = undefined;
        channel = undefined;
      });
      return open;
    });
    channel ??= connection.then(async (open) => {
      const created = await open.createConfirmChannel();
      created.on("return", (message: { properties: { messageId?: string } }) => {
        if (message.properties.messageId !== undefined) returned.add(message.properties.messageId);
      });
      created.on("error", () => undefined);
      created.on("close", () => {
        channel = undefined;
      });
      return created;
    });
    return channel;
  };

  return {
    async publishDomainEvents(events: readonly PublishableDomainEvent[]) {
      if (events.length === 0) return;
      try {
        const open = await openChannel();
        returned.clear();
        for (const event of events) {
          open.publish(domainEventsExchange, event.eventType, Buffer.from(JSON.stringify(event.payload)), {
            persistent: true,
            mandatory: true,
            messageId: event.id,
            correlationId: event.id,
            type: event.eventType,
            contentType: "application/json",
            timestamp: Math.floor(Date.now() / 1000),
            headers: { "x-nantty-subject": event.subject, "x-nantty-schema": "envelope.v1" },
          });
        }
        await open.waitForConfirms();
        const unroutable = events.filter((event) => returned.has(event.id));
        if (unroutable.length > 0) throw new Error(`publish domain events: ${unroutable.length} unroutable (first: ${unroutable[0]?.eventType})`);
      } catch (error) {
        await reset();
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    close: reset,
  };
}
