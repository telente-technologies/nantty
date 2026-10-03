import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type { NotificationsConfig } from "../configs/notifications.config.js";

export function createPrismaClient(config: Pick<NotificationsConfig, "databaseUrl" | "databaseSchema">): PrismaClient {
  const adapter = new PrismaPg({ connectionString: config.databaseUrl }, { schema: config.databaseSchema });
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
