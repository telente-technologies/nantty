import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import type { Logger } from "@nantty/fastify-platform";

import type { PublishableDomainEvent } from "../interfaces/domainEventPublisher.interface.js";
import type { JobQueue, MessageBroker, QueueConsumer, QueueMessage, QueueReader } from "../interfaces/jobQueue.interface.js";
import { QueueConsumerJob } from "../jobs/queueConsumer.job.js";

export class SqsQueueClient implements JobQueue, QueueReader {
  private readonly client: SQSClient;

  public constructor(region: string, endpoint: string | undefined) {
    this.client = new SQSClient({ region, ...(endpoint === undefined ? {} : { endpoint }) });
  }

  public async send(queueUrl: string, body: unknown, delaySeconds = 0): Promise<void> {
    await this.client.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(body), DelaySeconds: Math.min(900, Math.max(0, Math.ceil(delaySeconds))) }));
  }

  public async receive(queueUrl: string, maxMessages: number, waitSeconds: number): Promise<readonly QueueMessage[]> {
    const result = await this.client.send(new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: maxMessages, WaitTimeSeconds: waitSeconds }));
    return (result.Messages ?? []).flatMap((message) => (message.Body === undefined || message.ReceiptHandle === undefined ? [] : [{ id: message.MessageId ?? "", receiptHandle: message.ReceiptHandle, body: message.Body }]));
  }

  public async acknowledge(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
  }
}

export class SqsMessageBroker implements MessageBroker {
  public constructor(private readonly client: SqsQueueClient, private readonly logger: Logger) {}

  public send(queueUrl: string, body: unknown, delaySeconds = 0): Promise<void> {
    return this.client.send(queueUrl, body, delaySeconds);
  }

  public async publishDomainEvents(events: readonly PublishableDomainEvent[]): Promise<void> {
    if (events.length > 0) {
      const error = new Error("EVENT_BUS=sqs cannot publish domain events; refusing to acknowledge outbox events without delivery");
      this.logger.error("domain event publish is not configured for SQS", { count: events.length });
      throw error;
    }
  }

  public createConsumer(name: string, queueUrl: string, handleMessageBody: (body: string) => Promise<void>): QueueConsumer {
    return new QueueConsumerJob(name, queueUrl, this.client, handleMessageBody, this.logger);
  }

  public async close(): Promise<void> {}
}
