import { createPlatform } from "@nantty/fastify-platform";
import { describe, expect, it } from "vitest";

import type { MediaDatabase } from "../../src/databases/prisma.database.js";
import { RabbitMqConnection } from "../../src/integrations/rabbitMqConnection.integration.js";
import { registerHealthRoutes } from "../../src/routes/health.routes.js";

function databaseWith(count: () => Promise<number>): MediaDatabase {
  return { client: { outboxEvent: { count } } } as unknown as MediaDatabase;
}

async function readyz(database: MediaDatabase, broker: () => Promise<void>, healthy = true) {
  const app = await createPlatform({ name: "media-test", host: "127.0.0.1", port: 0, logger: false, rateLimit: false });
  registerHealthRoutes(app, database, async () => ({ healthy, ffmpeg: healthy }), broker);
  try { return (await app.inject("/readyz")).statusCode; }
  finally { await app.close(); }
}

describe("/readyz", () => {
  it("is ready when the database and broker respond", async () => {
    expect(await readyz(databaseWith(async () => 0), async () => undefined)).toBe(200);
  });

  it("is unavailable when the database rejects", async () => {
    expect(await readyz(databaseWith(async () => { throw new Error("down"); }), async () => undefined)).toBe(503);
  });

  it("is unavailable when the database hangs past the timeout", async () => {
    expect(await readyz(databaseWith(() => new Promise<number>(() => undefined)), async () => undefined)).toBe(503);
  });

  it("stays unavailable when a required capability is missing", async () => {
    expect(await readyz(databaseWith(async () => 0), async () => undefined, false)).toBe(503);
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
