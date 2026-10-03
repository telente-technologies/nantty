import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import type { JobQueue, QueueMessage, QueueReader } from "../interfaces/jobQueue.interface.js";

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
