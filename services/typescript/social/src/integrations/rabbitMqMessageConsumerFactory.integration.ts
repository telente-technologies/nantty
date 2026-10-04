import type { Logger } from "@zudojs/logger";

import type { MessageConsumerFactory, QueueConsumer } from "../interfaces/domainEventConsumer.interface.js";
import { RabbitMqConnection } from "./rabbitMqConnection.integration.js";
import { RabbitMqQueueConsumer } from "./rabbitMqQueueConsumer.integration.js";

export function createRabbitMqMessageConsumerFactory(url: string, prefetch: number, logger: Logger): MessageConsumerFactory & { close(): Promise<void> } {
  const connection = new RabbitMqConnection(url, "social", logger);
  return {
    createConsumer(name, queue, handleMessageBody): QueueConsumer {
      return new RabbitMqQueueConsumer(connection, { name, queue, prefetch, handleMessageBody, logger });
    },
    close: () => connection.close(),
  };
}
