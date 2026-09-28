import { createClient } from "redis";

import type { Integration } from "./lifecycle.integration.js";

const STARTUP_ATTEMPTS = 5;

function createRedisClient(url: string, isStarting: () => boolean) {
  return createClient({
    url,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries: number, cause: Error) =>
        isStarting() && retries >= STARTUP_ATTEMPTS ? cause : Math.min(retries * 200, 3_000),
    },
  });
}

type RedisClient = ReturnType<typeof createRedisClient>;

let client: RedisClient | undefined;

export function redis(): RedisClient {
  if (client === undefined) {
    throw new Error("Redis is not connected: start the runtime first.");
  }
  return client;
}

export const redisIntegration: Integration = {
  name: "redis",

  async start({ config, logger }) {
    let connected = false;
    const next = createRedisClient(config.redis.url, () => !connected);
    next.on("error", (error: unknown) => {
      logger.error("Redis connection error", { error });
    });
    await next.connect();
    connected = true;
    client = next;
  },

  async stop() {
    const current = client;
    client = undefined;
    if (current?.isOpen) await current.close();
  },

  async health() {
    if (client === undefined || !client.isReady) return false;
    return (await client.ping()) === "PONG";
  },
};
