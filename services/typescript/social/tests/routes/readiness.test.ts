import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import type { SocialDatabase } from "../../src/databases/prisma.database.js";
import { RabbitMqConnection } from "../../src/integrations/rabbitMqConnection.integration.js";
import { registerHealthRoutes } from "../../src/routes/health.routes.js";

function databaseWith(count: () => Promise<number>): SocialDatabase {
  return { client: { outboxEvent: { count } } } as unknown as SocialDatabase;
}

async function readyz(database: SocialDatabase, broker: () => Promise<void>) {
  const router = createRouter({});
  registerHealthRoutes(router, database, broker);
  const { response } = await router.dispatch(createRequestContext({ method: "GET", url: "/readyz", path: "/readyz" }));
  return response.status;
}

describe("/readyz", () => {
  it("is ready when the database and broker respond", async () => {
    expect(await readyz(databaseWith(async () => 0), async () => undefined)).toBe(200);
  });

  it("is unavailable when the database rejects", async () => {
    expect(await readyz(databaseWith(async () => { throw new Error("down"); }), async () => undefined)).toBe(503);
  });

  it("is unavailable when the database hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      const pending = readyz(databaseWith(() => new Promise<number>(() => undefined)), async () => undefined);
      await vi.advanceTimersByTimeAsync(2_100);
      expect(await pending).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is unavailable when the broker check fails", async () => {
    expect(await readyz(databaseWith(async () => 0), async () => { throw new Error("broker down"); })).toBe(503);
  });
});

describe("RabbitMqConnection.checkReachable", () => {
  const logger = { warn: () => undefined } as never;

  it("rejects when the broker cannot be reached", async () => {
    const connection = new RabbitMqConnection("amqp://broker", "test", logger, () => Promise.reject(new Error("refused")));
    await expect(connection.checkReachable()).rejects.toThrow("refused");
    await connection.close();
  });

  it("rejects once the connection is closed", async () => {
    const connection = new RabbitMqConnection("amqp://broker", "test", logger, () => Promise.reject(new Error("refused")));
    await connection.close();
    await expect(connection.checkReachable()).rejects.toThrow("closed");
  });
});
