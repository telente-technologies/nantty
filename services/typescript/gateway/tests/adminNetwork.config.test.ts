import { afterEach, expect, it, vi } from "vitest";

import { loadGatewayConfigFromEnvironment } from "../src/configs/gateway.config.js";

afterEach(() => vi.unstubAllEnvs());

it("requires a production admin network even when the other production guards pass", () => {
  const environment = {
    NODE_ENV: "production",
    DEPLOYMENT_ENVIRONMENT: "prod",
    ADMIN_IP_ALLOWLIST: "",
    AUTH_JWKS_URL: "https://identity.internal/jwks",
    AUTH_TOKEN_ISSUER: "https://api.nantty.com",
    UPSTREAM_IDENTITY_URL: "https://identity.internal",
    VALKEY_URL: "rediss://valkey.internal",
    TRUSTED_PROXY_HOPS: "1",
    GATEWAY_IDENTITY_SECRET: "a".repeat(48),
    ADMIN_INTERNAL_API_TOKEN: "b".repeat(48),
    IDENTITY_INTERNAL_TOKEN: "c".repeat(48),
    TRUST_INTERNAL_TOKEN: "d".repeat(48),
    TURNSTILE_SECRET_KEY: "e".repeat(48),
  };
  for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value);
  expect(() => loadGatewayConfigFromEnvironment()).toThrow(/ADMIN_IP_ALLOWLIST is required/);
  vi.stubEnv("ADMIN_IP_ALLOWLIST", "203.0.113.10/32");
  expect(loadGatewayConfigFromEnvironment().adminIpAllowList).toEqual(["203.0.113.10/32"]);
});
