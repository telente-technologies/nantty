import type { Logger } from "@zudojs/logger";

import { PoisonMessageError } from "../errors/poisonMessage.error.js";
import type { QueueConsumer, QueueReader } from "../interfaces/jobQueue.interface.js";

export class QueueConsumerJob implements QueueConsumer {
  private running = false;
  private loop: Promise<void> | undefined;

  public constructor(
    private readonly name: string,
    private readonly queueUrl: string,
    private readonly reader: QueueReader,
    private readonly handleMessageBody: (body: string) => Promise<void>,
    private readonly logger: Logger,
    private readonly waitSeconds = 20,
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.loop = this.poll();
  }

  public async stop(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const messages = await this.reader.receive(this.queueUrl, 10, this.waitSeconds);
        for (const message of messages) await this.process(message.id, message.receiptHandle, message.body);
      } catch (error) {
        this.logger.error("queue poll failed", { queue: this.name, error: error instanceof Error ? error.message : String(error) });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async process(messageId: string, receiptHandle: string, body: string): Promise<void> {
    try {
      await this.handleMessageBody(body);
    } catch (error) {
      if (error instanceof PoisonMessageError) this.logger.warn("poison message dropped", { queue: this.name, messageId, error: error.message });
      else return void this.logger.error("message handling failed, it will be retried", { queue: this.name, messageId, error: error instanceof Error ? error.message : String(error) });
    }
    await this.reader.acknowledge(this.queueUrl, receiptHandle).catch((error: unknown) => this.logger.error("message acknowledge failed", { queue: this.name, messageId, error: error instanceof Error ? error.message : String(error) }));
  }
}
