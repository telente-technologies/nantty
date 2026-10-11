import { connect, type ConfirmChannel, type Options } from "amqplib";
import type { Logger } from "@zudojs/logger";

export type AmqpChannel = Pick<ConfirmChannel, "publish" | "consume" | "cancel" | "ack" | "nack" | "prefetch" | "close" | "on" | "off">;

export interface AmqpModel {
  createConfirmChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
  on(event: "close" | "error", listener: (error?: Error) => void): unknown;
}

export type AmqpConnect = (url: string, connectionName: string) => Promise<AmqpModel>;

const connectToRabbitMq: AmqpConnect = (url, connectionName) => connect(url, { clientProperties: { connection_name: connectionName } });

export function reconnectDelayMs(attempt: number): number {
  const base = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
  return base / 2 + Math.random() * (base / 2);
}

export const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const liveConnections = new Set<RabbitMqConnection>();

export async function checkRabbitMqConnections(): Promise<void> {
  await Promise.all([...liveConnections].map((connection) => connection.checkReachable()));
}

export class RabbitMqConnection {
  private model: Promise<AmqpModel> | undefined;
  private closed = false;

  public constructor(
    private readonly url: string,
    private readonly connectionName: string,
    private readonly logger: Logger,
    private readonly connectFn: AmqpConnect = connectToRabbitMq,
    private readonly delayMs: (attempt: number) => number = reconnectDelayMs,
  ) {
    liveConnections.add(this);
  }

  public async checkReachable(): Promise<void> {
    if (this.closed) throw new Error("rabbitmq connection is closed");
    try {
      const channel = await (await this.connected()).createConfirmChannel();
      await channel.close();
    } catch (error) {
      this.model = undefined;
      throw error;
    }
  }

  public async openChannel(): Promise<AmqpChannel> {
    for (let attempt = 0; ; attempt += 1) {
      if (this.closed) throw new Error("rabbitmq connection is closed");
      try {
        return await (await this.connected()).createConfirmChannel();
      } catch (error) {
        this.model = undefined;
        this.logger.warn("rabbitmq unavailable; reconnecting", { attempt: attempt + 1, error: error instanceof Error ? error.message : String(error) });
        await sleep(this.delayMs(attempt));
      }
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    liveConnections.delete(this);
    const current = this.model;
    this.model = undefined;
    await current?.then((model) => model.close()).catch(() => undefined);
  }

  private connected(): Promise<AmqpModel> {
    if (this.model === undefined) {
      const pending = this.connectFn(this.url, this.connectionName).then((model) => {
        model.on("error", (error) => this.logger.warn("rabbitmq connection error", { error: error?.message ?? "unknown" }));
        model.on("close", () => {
          if (this.model === pending) this.model = undefined;
        });
        return model;
      });
      this.model = pending;
    }
    return this.model;
  }
}

export function publishConfirmed(channel: AmqpChannel, exchange: string, routingKey: string, content: Buffer, options: Options.Publish): Promise<void> {
  return new Promise((resolve, reject) => {
    const returned = (message: { properties: { messageId?: string }; fields: { routingKey: string } }) => {
      if (message.properties.messageId === options.messageId) reject(new Error(`message ${options.messageId} was unroutable with key ${message.fields.routingKey}`));
    };
    channel.on("return", returned as never);
    const settle = (error: unknown) => {
      channel.off("return", returned as never);
      if (error) reject(error instanceof Error ? error : new Error("broker rejected the message"));
      else resolve();
    };
    try {
      channel.publish(exchange, routingKey, content, { ...options, mandatory: true, persistent: true }, settle);
    } catch (error) {
      settle(error);
    }
  });
}
