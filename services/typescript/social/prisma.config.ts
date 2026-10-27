import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["SOCIAL_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/nantty?schema=social" },
});
