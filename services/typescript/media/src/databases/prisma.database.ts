import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";
import { splitSchemaFromConnectionString } from "../utils/connectionString.util.js";

export interface MediaDatabase {
  readonly client: PrismaClient;
  transaction<T>(work: (transaction: Db) => Promise<T>): Promise<T>;
  disconnect(): Promise<void>;
}

const transactionOptions = { maxWait: 5_000, timeout: 15_000 } as const;

export function createMediaDatabase(databaseUrl: string): MediaDatabase {
  const { connectionString, schema } = splitSchemaFromConnectionString(databaseUrl);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }, schema === undefined ? {} : { schema }) });
  return {
    client,
    transaction: (work) => client.$transaction((transaction) => work(transaction), transactionOptions),
    disconnect: () => client.$disconnect(),
  };
}
