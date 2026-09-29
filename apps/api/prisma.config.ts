import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: DATABASE_URL comes from the environment.
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: { seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
