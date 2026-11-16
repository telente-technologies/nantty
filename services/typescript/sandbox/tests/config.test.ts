import { describe, expect, it } from "vitest";

import { loadSandboxConfig } from "../src/config.js";
import { createSandboxCredential, hashSandboxCredential, isSandboxCredentialFormat } from "../src/credentials.js";

const validEnvironment = {
  SANDBOX_DATABASE_URL: "postgresql://sandbox:sandbox-pass@sandbox-db:5432/nantty_sandbox",
  PRODUCTION_DATABASE_URL: "postgresql://nantty:prod-pass@prod-db:5432/nantty",
  SANDBOX_CONTROL_TOKEN: "sandbox-control-secret-value-that-is-long-enough",
  NODE_ENV: "production",
};

describe("sandbox isolation configuration", () => {
  it("requires a dedicated database and control credential", () => {
    expect(() => loadSandboxConfig({})).toThrow(/SANDBOX_DATABASE_URL/);
    expect(() => loadSandboxConfig({ ...validEnvironment, SANDBOX_CONTROL_TOKEN: "short" })).toThrow(/at least 32/);
  });

  it("rejects the production database target even when credentials differ", () => {
    expect(() => loadSandboxConfig({ ...validEnvironment, SANDBOX_DATABASE_URL: "postgresql://sandbox:other@prod-db:5432/nantty" })).toThrow(/targets must be different/);
  });

  it("requires a production database reference in production", () => {
    const { PRODUCTION_DATABASE_URL: _omitted, ...environment } = validEnvironment;
    expect(() => loadSandboxConfig(environment)).toThrow(/PRODUCTION_DATABASE_URL/);
  });

  it("does not accept a production database URL fallback", () => {
    const { SANDBOX_DATABASE_URL: _omitted, ...environment } = validEnvironment;
    expect(() => loadSandboxConfig(environment)).toThrow(/SANDBOX_DATABASE_URL/);
  });

  it("accepts only a canonical base64 32-byte webhook encryption key", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    expect(loadSandboxConfig({ ...validEnvironment, SANDBOX_WEBHOOK_SECRET_ENCRYPTION_KEY: key }).webhookSecretEncryptionKey).toEqual(Buffer.alloc(32, 7));
    expect(loadSandboxConfig(validEnvironment).webhookSecretEncryptionKey).toBeNull();
    expect(() => loadSandboxConfig({ ...validEnvironment, SANDBOX_WEBHOOK_SECRET_ENCRYPTION_KEY: "not-a-key" })).toThrow(/32-byte key/);
  });
});

describe("sandbox credentials", () => {
  it("issues only test-prefixed credentials and stores a non-reversible digest", () => {
    const credential = createSandboxCredential();
    expect(isSandboxCredentialFormat(credential.token)).toBe(true);
    expect(credential.tokenHash).toBe(hashSandboxCredential(credential.token));
    expect(credential.tokenHash).not.toContain(credential.token);
    expect(isSandboxCredentialFormat("ntsb_live_abcdefghijklmnopqrstuvwx1234567890abcdef")).toBe(false);
  });
});
