import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
}

function withSchemaParameter(url: string, schema: string | undefined): string {
  if (url === "" || schema === undefined || schema === "" || /[?&]schema=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}schema=${encodeURIComponent(schema)}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: withSchemaParameter(process.env["DATABASE_URL"] ?? "", process.env["DATABASE_SCHEMA"]) },
});
