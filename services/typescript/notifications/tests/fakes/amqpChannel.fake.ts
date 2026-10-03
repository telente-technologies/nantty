import { EventEmitter } from "node:events";

import type { ConsumeMessage, Options } from "amqplib";

import type { AmqpChannel, AmqpModel } from "../../src/integrations/rabbitMqConnection.integration.js";

export interface RecordedPublish {
  readonly exchange: string;
  readonly routingKey: string;
  readonly content: string;
  readonly options: Options.Publish;
}

export class FakeAmqpChannel extends EventEmitter {
  public readonly published: RecordedPublish[] = [];
  public readonly settled: { readonly tag: number; readonly outcome: "ack" | "nack"; readonly requeue: boolean }[] = [];
  public prefetchCount = 0;
  public nackPublishes = false;
  public unroutableKeys = new Set<string>();
  public cancelled = false;
  public closed = false;
  private onMessage: ((message: ConsumeMessage | null) => void) | undefined;

  public publish(exchange: string, routingKey: string, content: Buffer, options: Options.Publish = {}, callback?: (error: unknown, ok: object) => void): boolean {
    this.published.push({ exchange, routingKey, content: content.toString("utf8"), options });
    setImmediate(() => {
      if (options.mandatory === true && this.unroutableKeys.has(routingKey)) this.emit("return", { fields: { routingKey }, properties: { messageId: options.messageId }, content });
      callback?.(this.nackPublishes ? new Error("nacked") : null, {});
    });
    return true;
  }

  public async consume(_queue: string, onMessage: (message: ConsumeMessage | null) => void) {
    this.onMessage = onMessage;
    return { consumerTag: "ctag-1" };
  }

  public deliver(tag: number, body: string, headers: Record<string, unknown> = {}): void {
    this.onMessage?.({ content: Buffer.from(body), fields: { deliveryTag: tag }, properties: { messageId: `m-${tag}`, headers, type: "job" } } as unknown as ConsumeMessage);
  }

  public async cancel() {
    this.cancelled = true;
    return {};
  }

  public ack(message: ConsumeMessage): void {
    this.settled.push({ tag: message.fields.deliveryTag, outcome: "ack", requeue: false });
  }

  public nack(message: ConsumeMessage, _allUpTo?: boolean, requeue = true): void {
    this.settled.push({ tag: message.fields.deliveryTag, outcome: "nack", requeue });
  }

  public async prefetch(count: number) {
    this.prefetchCount = count;
    return {};
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  }
}

export class FakeAmqpModel extends EventEmitter implements AmqpModel {
  public opened = 0;

  public constructor(private readonly channels: FakeAmqpChannel[]) {
    super();
  }

  public async createConfirmChannel(): Promise<AmqpChannel> {
    this.opened += 1;
    return (this.channels.shift() ?? new FakeAmqpChannel()) as unknown as AmqpChannel;
  }

  public async close(): Promise<void> {
    this.emit("close");
  }
}

export async function waitUntil(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
