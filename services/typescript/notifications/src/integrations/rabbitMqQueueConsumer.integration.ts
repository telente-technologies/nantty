import type { ConsumeMessage } from "amqplib";
import type { Logger } from "@nantty/fastify-platform";

import { retryExchange } from "../constants/rabbitMq.constant.js";
import { PoisonMessageError } from "../errors/poisonMessage.error.js";
import type { QueueConsumer } from "../interfaces/jobQueue.interface.js";
import { deliveryAttemptFromHeaders, headersForRetry, retryQueueName, retryTierAfterFailedAttempt } from "../utils/retryTier.util.js";
import { publishConfirmed, reconnectDelayMs, sleep, type AmqpChannel, type RabbitMqConnection } from "./rabbitMqConnection.integration.js";

export interface RabbitMqConsumerOptions {
  readonly name: string;
  readonly queue: string;
  readonly prefetch: number;
  readonly handleMessageBody: (body: string) => Promise<void>;
  readonly logger: Logger;
  readonly delayMs?: (attempt: number) => number;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class RabbitMqQueueConsumer implements QueueConsumer {
  private running = false;
  private loop: Promise<void> | undefined;
  private channel: AmqpChannel | undefined;
  private consumerTag: string | undefined;
  private inFlight: Promise<void> = Promise.resolve();
  private releaseChannelWait: (() => void) | undefined;

  public constructor(private readonly connection: RabbitMqConnection, private readonly options: RabbitMqConsumerOptions) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.consumeUntilStopped();
  }

  public async stop(): Promise<void> {
    this.running = false;
    const channel = this.channel;
    if (channel !== undefined && this.consumerTag !== undefined) await channel.cancel(this.consumerTag).catch(() => undefined);
    await this.inFlight;
    await channel?.close().catch(() => undefined);
    this.releaseChannelWait?.();
    await this.loop;
  }

  private async consumeUntilStopped(): Promise<void> {
    for (let attempt = 0; this.running; attempt += 1) {
      try {
        await this.consumeUntilChannelCloses();
        attempt = 0;
      } catch (error) {
        this.options.logger.warn("queue consumer interrupted; reconnecting", { queue: this.options.name, error: describe(error) });
      }
      if (this.running) await sleep((this.options.delayMs ?? reconnectDelayMs)(attempt));
    }
  }

  private async consumeUntilChannelCloses(): Promise<void> {
    const channel = await this.connection.openChannel();
    this.channel = channel;
    const closed = new Promise<void>((resolve) => {
      this.releaseChannelWait = resolve;
      channel.on("close", () => resolve());
      channel.on("error", () => resolve());
    });
    await channel.prefetch(this.options.prefetch);
    const reply = await channel.consume(this.options.queue, (message) => {
      if (message === null) return this.releaseChannelWait?.();
      this.inFlight = this.inFlight.then(() => this.settle(channel, message)).catch((error: unknown) => {
        this.options.logger.warn("delivery could not be settled; the broker will redeliver it", { queue: this.options.name, error: describe(error) });
      });
    }, { noAck: false });
    this.consumerTag = reply.consumerTag;
    await closed;
    await this.inFlight;
  }

  private async settle(channel: AmqpChannel, message: ConsumeMessage): Promise<void> {
    const context = { queue: this.options.name, messageId: message.properties.messageId as string | undefined };
    try {
      await this.options.handleMessageBody(message.content.toString("utf8"));
      channel.ack(message);
    } catch (error) {
      if (error instanceof PoisonMessageError) {
        this.options.logger.warn("poison message dead-lettered", { ...context, error: describe(error) });
        channel.nack(message, false, false);
      } else if (!this.running) {
        channel.nack(message, false, true);
      } else {
        await this.retryOrDeadLetter(channel, message, error, context);
      }
    }
  }

  private async retryOrDeadLetter(channel: AmqpChannel, message: ConsumeMessage, error: unknown, context: Record<string, unknown>): Promise<void> {
    const failedAttempt = deliveryAttemptFromHeaders(message.properties.headers) + 1;
    const tier = retryTierAfterFailedAttempt(failedAttempt);
    if (tier === null) {
      this.options.logger.error("message dead-lettered after the last attempt", { ...context, attempt: failedAttempt, error: describe(error) });
      channel.nack(message, false, false);
      return;
    }
    try {
      const { headers, ...properties } = message.properties;
      await publishConfirmed(channel, retryExchange, retryQueueName(this.options.queue, tier), message.content, {
        ...Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined)),
        headers: headersForRetry(headers, failedAttempt, error),
      });
      this.options.logger.warn("message handling failed; retry scheduled", { ...context, attempt: failedAttempt, delay: tier.name, error: describe(error) });
      channel.ack(message);
    } catch (retryError) {
      this.options.logger.error("retry could not be scheduled; message requeued", { ...context, error: describe(retryError) });
      channel.nack(message, false, true);
    }
  }
}
