import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient as IdentityReadClient } from "../generated/identity/client.js";
import { splitSchemaFromConnectionString } from "../utils/connectionString.util.js";

export function createIdentityReadClient(databaseUrl: string): IdentityReadClient {
  const { connectionString } = splitSchemaFromConnectionString(databaseUrl);
  return new IdentityReadClient({ adapter: new PrismaPg({ connectionString }) });
}

export type { IdentityReadClient };
