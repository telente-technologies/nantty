import { PrismaPg } from "@prisma/adapter-pg";
import {
  createDatabaseClient,
  type DatabaseClient,
} from "@zudojs/database";
import { ConfigurationError } from "@zudojs/errors";

import { PrismaClient } from "../generated/prisma/client.js";
import type { Integration } from "./integration.js";

let client: PrismaClient | undefined;
let database: DatabaseClient | undefined;

/** The connected Prisma client. Throws before the runtime has started. */
export function prisma(): PrismaClient {
  if (client === undefined) {
    throw new Error("The database is not connected: start the runtime first.");
  }
  return client;
}

export const databaseIntegration: Integration = {
  name: "database",

  async start({ config }) {
    if (config.database.url === "") {
      throw new ConfigurationError(
        "DATABASE_URL is not set. Copy .env.example to .env, or set it in the environment.",
      );
    }
    const next = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.database.url }),
    });
    const wrapper = createDatabaseClient({ prisma: next });
    await wrapper.connect();
    client = next;
    database = wrapper;
  },

  async stop() {
    const current = database;
    database = undefined;
    client = undefined;
    await current?.disconnect();
  },

  async health() {
    if (database === undefined) return false;
    return database.ping().then(() => true, () => false);
  },
};
