import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

export function createSearchPrisma(databaseUrl: string, schema: string): PrismaClient {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error(`invalid search schema name: ${schema}`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, options: `-c search_path=${schema},public` }, { schema }) });
}

export type { PrismaClient };
