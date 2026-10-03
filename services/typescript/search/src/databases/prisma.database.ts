import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

export function createSearchPrisma(databaseUrl: string, schema: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }, { schema }) });
}

export type { PrismaClient };
