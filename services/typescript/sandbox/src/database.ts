import { Pool } from "pg";

export function createSandboxDatabase(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10, connectionTimeoutMillis: 2_000, idleTimeoutMillis: 30_000, statement_timeout: 5_000 });
}

export type SandboxDatabase = ReturnType<typeof createSandboxDatabase>;
