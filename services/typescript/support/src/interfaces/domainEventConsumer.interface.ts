export interface QueueConsumer {
  start(): void;
  stop(): Promise<void>;
}

export interface MessageConsumerFactory {
  createConsumer(name: string, queue: string, handleMessageBody: (body: string) => Promise<void>): QueueConsumer;
}
