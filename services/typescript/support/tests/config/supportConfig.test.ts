import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSupportConfigFromEnvironment } from "../../src/configs/support.config.js";

function setBaseEnvironment(): void {
  vi.stubEnv("NODE_ENV", "staging");
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/support");
  vi.stubEnv("SUPPORT_INTERNAL_TOKEN", "support-internal-token-long-enough");
  vi.stubEnv("GATEWAY_IDENTITY_SECRET", "gateway-identity-secret-long-enough-000");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("support staff authentication config", () => {
  it("refuses to boot in staging without a staff JWKS", () => {
    setBaseEnvironment();
    expect(() => loadSupportConfigFromEnvironment()).toThrow(/AUTH_JWKS_URL is required in production and staging/);
  });

  it("requires an issuer when staging has a staff JWKS", () => {
    setBaseEnvironment();
    vi.stubEnv("AUTH_JWKS_URL", "https://identity.test/.well-known/jwks.json");
    expect(() => loadSupportConfigFromEnvironment()).toThrow(/AUTH_TOKEN_ISSUER is required/);
  });

  it("accepts staging when the staff JWKS and issuer are set", () => {
    setBaseEnvironment();
    vi.stubEnv("AUTH_JWKS_URL", "https://identity.test/.well-known/jwks.json");
    vi.stubEnv("AUTH_TOKEN_ISSUER", "https://identity.test");
    expect(loadSupportConfigFromEnvironment().staffAuth).toEqual({ jwksUrl: "https://identity.test/.well-known/jwks.json", issuer: "https://identity.test" });
  });
});
