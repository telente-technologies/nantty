import { resolve } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const scratchpad = "/tmp/claude-1000/-home-oyinlola-Desktop-nantty/2de9a368-cb79-4f3f-8721-930271160239/scratchpad";

process.env["SMOKE_IDENTITY_LOG"] ??= `${scratchpad}/logs/goIdentity.log`;
process.env["SMOKE_GATEWAY_URL"] ??= "http://127.0.0.1:8080";
process.env["SMOKE_FAKE_FLUTTERWAVE_URL"] ??= "http://127.0.0.1:18998";

export type AppName = "webapp" | "studio" | "seller" | "ads" | "admin" | "web";

export const appPorts: Record<AppName, number> = { web: 3100, seller: 3200, ads: 3300, admin: 3400, webapp: 3500, studio: 3600 };

export function appUrl(app: AppName): string {
  return process.env[`E2E_${app.toUpperCase()}_URL`] ?? `http://localhost:${appPorts[app]}`;
}

export const gatewayUrl = process.env["SMOKE_GATEWAY_URL"];
export const fakeFlutterwaveUrl = process.env["SMOKE_FAKE_FLUTTERWAVE_URL"];
export const socialDatabaseUrl = process.env["E2E_SOCIAL_DATABASE_URL"] ?? "postgres://svc_social:svc_social_local_only@localhost:15432/nantty";
