import type { Logger } from "@zudojs/logger";

import { jobsExchange, maximumDeliveryAttempts, retryExchange } from "../constants/rabbitMq.constant.js";
import type { Job, JobHandlers, JobQueue } from "../interfaces/jobQueue.interface.js";
import { delayTierAtMost, retryQueueName } from "../utils/retryTier.util.js";
import { PoisonMessageError } from "../errors/poisonMessage.error.js";
import { publishConfirmed, type AmqpChannel, type RabbitMqConnection } from "./rabbitMqConnection.integration.js";
import { RabbitMqQueueConsumer } from "./rabbitMqQueueConsumer.integration.js";

export function createRabbitMqJobQueue(connection: RabbitMqConnection): JobQueue & { close(): Promise<void> } {
  let publishChannel: Promise<AmqpChannel> | undefined;
  const channel = (): Promise<AmqpChannel> => {
    if (publishChannel === undefined) {
      const pending = connection.openChannel().then((opened) => {
        opened.on("close", () => { if (publishChannel === pending) publishChannel = undefined; });
        opened.on("error", () => undefined);
        return opened;
      });
      publishChannel = pending;
      pending.catch(() => { if (publishChannel === pending) publishChannel = undefined; });
    }
    return publishChannel;
  };
  return {
    async enqueueJob(queueName, job: Job, delayMilliseconds = 0) {
      const tier = delayTierAtMost(Math.floor(delayMilliseconds / 1000));
      const [exchange, routingKey] = tier === null ? [jobsExchange, queueName] : [retryExchange, retryQueueName(queueName, tier)];
      const opened = await channel();
      try {
        await publishConfirmed(opened, exchange, routingKey, Buffer.from(JSON.stringify(job)), { messageId: job.id, type: job.type, contentType: "application/json", timestamp: Math.floor(Date.now() / 1000) });
      } catch (error) {
        publishChannel = undefined;
        await opened.close().catch(() => undefined);
        throw error;
      }
    },
    close: () => connection.close(),
  };
}

export function parseJobMessage(body: string): Job {
  try {
    const parsed = JSON.parse(body) as Partial<Job>;
    if (typeof parsed.id === "string" && typeof parsed.type === "string" && typeof parsed.payload === "object" && parsed.payload !== null) return { id: parsed.id, type: parsed.type, payload: parsed.payload };
  } catch {
    // falls through to the poison error
  }
  throw new PoisonMessageError("malformed job message");
}

export function createJobMessageHandler(handlers: JobHandlers) {
  return async (body: string, attempt: number): Promise<void> => {
    const job = parseJobMessage(body);
    const handler = handlers[job.type];
    if (handler === undefined) throw new PoisonMessageError(`unknown job type ${job.type}`);
    await handler(job.payload, { attempt, maximumAttempts: maximumDeliveryAttempts, isFinalAttempt: attempt >= maximumDeliveryAttempts });
  };
}

export function startRabbitMqJobConsumer(options: { readonly connection: RabbitMqConnection; readonly queue: string; readonly handlers: JobHandlers; readonly prefetch: number; readonly logger: Logger }): RabbitMqQueueConsumer {
  const consumer = new RabbitMqQueueConsumer(options.connection, { name: options.queue, queue: options.queue, prefetch: options.prefetch, handleMessageBody: createJobMessageHandler(options.handlers), logger: options.logger });
  consumer.start();
  return consumer;
}
