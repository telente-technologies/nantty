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

describe("notifications push provider configuration", () => {
  it("keeps push delivery in log-only mode by default", () => {
    stubConfiguration("ses");
    vi.stubEnv("PUSH_PROVIDER", "log");
    expect(loadNotificationsConfigFromEnvironment().pushProvider).toBe("log");
  });

  it("retains the existing Expo-only deployment mode", () => {
    stubConfiguration("ses");
    vi.stubEnv("PUSH_PROVIDER", "expo");
    expect(loadNotificationsConfigFromEnvironment().pushProvider).toBe("expo");
  });

  it("requires all FCM secrets before enabling FCM or multi-provider delivery", () => {
    stubConfiguration("ses");
    vi.stubEnv("PUSH_PROVIDER", "fcm");
    expect(() => loadNotificationsConfigFromEnvironment()).toThrow(/FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY are required/);

    vi.stubEnv("FCM_PROJECT_ID", "nantty-test");
    vi.stubEnv("FCM_CLIENT_EMAIL", "push@example.test");
    vi.stubEnv("FCM_PRIVATE_KEY", "secret-is-read-but-never-printed");
    expect(loadNotificationsConfigFromEnvironment().fcm?.projectId).toBe("nantty-test");
  });

  it("fails closed for unknown push providers", () => {
    stubConfiguration("ses");
    vi.stubEnv("PUSH_PROVIDER", "firebase-unofficial");
    expect(() => loadNotificationsConfigFromEnvironment()).toThrow(/PUSH_PROVIDER must be one of/);
  });
});

describe("re-engagement quiet-hour configuration", () => {
  it("defaults to 21:00–08:00 and accepts valid configured bounds", () => {
    stubConfiguration("ses");
    expect(loadNotificationsConfigFromEnvironment().reengagement).toEqual({ quietHoursStart: "21:00", quietHoursEnd: "08:00" });
    vi.stubEnv("REENGAGEMENT_QUIET_HOURS_START", "22:15");
    vi.stubEnv("REENGAGEMENT_QUIET_HOURS_END", "07:30");
    expect(loadNotificationsConfigFromEnvironment().reengagement).toEqual({ quietHoursStart: "22:15", quietHoursEnd: "07:30" });
  });

  it("rejects malformed configured bounds", () => {
    stubConfiguration("ses");
    vi.stubEnv("REENGAGEMENT_QUIET_HOURS_START", "25:00");
    expect(() => loadNotificationsConfigFromEnvironment()).toThrow(/REENGAGEMENT_QUIET_HOURS_START must use 24-hour HH:mm format/);
  });
});
