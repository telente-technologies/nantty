import type { DomainEventPublisher } from "./domainEventPublisher.interface.js";

export interface JobQueue {
  send(queueUrl: string, body: unknown, delaySeconds?: number): Promise<void>;
}

export interface QueueMessage {
  readonly id: string;
  readonly receiptHandle: string;
  readonly body: string;
}

export interface QueueReader {
  receive(queueUrl: string, maxMessages: number, waitSeconds: number): Promise<readonly QueueMessage[]>;
  acknowledge(queueUrl: string, receiptHandle: string): Promise<void>;
}

export interface QueueConsumer {
  start(): void;
  stop(): Promise<void>;
}

export interface MessageBroker extends JobQueue, DomainEventPublisher {
  createConsumer(name: string, queue: string, handleMessageBody: (body: string) => Promise<void>): QueueConsumer;
  close(): Promise<void>;
}
