import { afterEach, describe, expect, it, vi } from "vitest";

import { loadNotificationsConfigFromEnvironment } from "../src/configs/notifications.config.js";

const configuration = {
  GATEWAY_IDENTITY_SECRET: "gateway-identity-secret-that-is-long-enough",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  RABBITMQ_URL: "amqp://127.0.0.1",
  SES_FROM_ADDRESS: "no-reply@example.test",
  SES_CONFIGURATION_SET: "local-test",
  IDENTITY_INTERNAL_URL: "http://127.0.0.1:8080",
  IDENTITY_INTERNAL_TOKEN: "local-test-token",
  AUTH_JWKS_URL: "http://127.0.0.1:8081/.well-known/jwks.json",
  AUTH_TOKEN_ISSUER: "https://auth.example.test",
  UNSUBSCRIBE_SIGNING_SECRET: "unsubscribe-signing-secret-long-enough",
  PUBLIC_API_BASE_URL: "http://127.0.0.1:3000",
} as const;

afterEach(() => vi.unstubAllEnvs());

function stubConfiguration(emailProvider: string) {
  for (const [name, value] of Object.entries(configuration)) vi.stubEnv(name, value);
  vi.stubEnv("EMAIL_PROVIDER", emailProvider);
  vi.stubEnv("NODE_ENV", "test");
}

describe("notifications email provider configuration", () => {
  it("keeps SES as the explicit default and accepts the local log adapter", () => {
    stubConfiguration("ses");
    expect(loadNotificationsConfigFromEnvironment().emailProvider).toBe("ses");

    vi.stubEnv("EMAIL_PROVIDER", "log");
    expect(loadNotificationsConfigFromEnvironment().emailProvider).toBe("log");
  });

  it("fails closed for an unknown provider instead of silently selecting SES", () => {
    stubConfiguration("ses-mock");
    expect(() => loadNotificationsConfigFromEnvironment()).toThrow(/EMAIL_PROVIDER must be either 'ses' or 'log'/);
  });
});
