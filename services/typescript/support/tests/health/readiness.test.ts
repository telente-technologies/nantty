import { createRequestContext } from "@zudojs/http";
import { describe, expect, it, vi } from "vitest";

import { RabbitMqConnection } from "../../src/integrations/rabbitMqConnection.integration.js";
import { buildSupportRouter, type RouteDependencies } from "../../src/routes/index.js";

type Probe = () => Promise<void>;
const ok: Probe = async () => undefined;
const failing: Probe = async () => { throw new Error("down"); };

async function readyz(probeDatabase: Probe, probeBroker: Probe) {
  const dependencies = { probeDatabase, probeBroker } as unknown as RouteDependencies;
  const router = buildSupportRouter(dependencies);
  const { response } = await router.dispatch(createRequestContext({ method: "GET", url: "/readyz", path: "/readyz" }));
  return response.status;
}

describe("/readyz", () => {
  it("is ready when the database and broker respond", async () => {
    expect(await readyz(ok, ok)).toBe(200);
  });

  it("is unavailable when the database rejects", async () => {
    expect(await readyz(failing, ok)).toBe(503);
  });

  it("is unavailable when the database hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      const pending = readyz(() => new Promise<void>(() => undefined), ok);
      await vi.advanceTimersByTimeAsync(2_100);
      expect(await pending).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is unavailable when the broker check fails", async () => {
    expect(await readyz(ok, failing)).toBe(503);
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
