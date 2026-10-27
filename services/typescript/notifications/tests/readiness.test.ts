import { createRequestContext } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createRequestHandler } from "../src/app.js";
import type { Container } from "../src/container.js";
import { RabbitMqConnection } from "../src/integrations/rabbitMqConnection.integration.js";

const silentLogger = { warn: () => undefined, error: () => undefined, info: () => undefined } as never;

async function readyz(count: () => Promise<number>, broker: () => Promise<void>) {
  const container = { prisma: { notification: { count } } } as unknown as Container;
  const response = await createRequestHandler([], silentLogger, container, broker)(createRequestContext({ method: "GET", url: "/readyz", path: "/readyz" }));
  return response.status;
}

describe("/readyz", () => {
  it("is ready when the database and broker respond", async () => {
    expect(await readyz(async () => 0, async () => undefined)).toBe(200);
  });

  it("is unavailable when the database rejects", async () => {
    expect(await readyz(async () => { throw new Error("down"); }, async () => undefined)).toBe(503);
  });

  it("is unavailable when the database hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      const pending = readyz(() => new Promise<number>(() => undefined), async () => undefined);
      await vi.advanceTimersByTimeAsync(2_100);
      expect(await pending).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is unavailable when the broker check fails", async () => {
    expect(await readyz(async () => 0, async () => { throw new Error("broker down"); })).toBe(503);
  });
});

describe("RabbitMqConnection.checkReachable", () => {
  it("rejects when the broker cannot be reached", async () => {
    const connection = new RabbitMqConnection("amqp://broker", "test", silentLogger, () => Promise.reject(new Error("refused")));
    await expect(connection.checkReachable()).rejects.toThrow("refused");
    await connection.close();
  });

  it("rejects once the connection is closed", async () => {
    const connection = new RabbitMqConnection("amqp://broker", "test", silentLogger, () => Promise.reject(new Error("refused")));
    await connection.close();
    await expect(connection.checkReachable()).rejects.toThrow("closed");
  });
});
