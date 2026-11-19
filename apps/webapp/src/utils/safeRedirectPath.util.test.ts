import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDeveloperSsoContinuePath, readSafeRelativeRedirectPath } from "./safeRedirectPath.util";

describe("developer SSO continuation", () => {
  const valid = "/api/v1/auth/sso/authorize?client_id=developer&redirect_uri=https%3A%2F%2Fdevelopers.nantty.com%2Fapi%2Fauth%2Fcallback&state=abc";
  it("resumes only the exact authorization route", () => {
    assert.equal(readDeveloperSsoContinuePath(valid), valid);
    assert.equal(readDeveloperSsoContinuePath("//evil.example"), null);
    assert.equal(readDeveloperSsoContinuePath("/api/v1/auth/sso/authorize/extra?client_id=x&redirect_uri=x&state=x"), null);
    assert.equal(readDeveloperSsoContinuePath("/api/v1/auth/sso/authorize?client_id=x&redirect_uri=x"), null);
  });
});

describe("readSafeRelativeRedirectPath", () => {
  const fallback = "/settings";

  it("keeps safe same-origin paths and rejects external or protocol-relative URLs", () => {
    assert.equal(readSafeRelativeRedirectPath("/orders?tab=open", fallback), "/orders?tab=open");
    assert.equal(readSafeRelativeRedirectPath("https://attacker.example/path", fallback), fallback);
    assert.equal(readSafeRelativeRedirectPath("//attacker.example/path", fallback), fallback);
    assert.equal(readSafeRelativeRedirectPath("/\\attacker.example/path", fallback), fallback);
  });

  it("rejects BFF paths to prevent redirecting into internal endpoints", () => {
    assert.equal(readSafeRelativeRedirectPath("/bff/auth/logout", fallback), fallback);
  });

  it("keeps encoded separators within the application origin", () => {
    const candidate = readSafeRelativeRedirectPath("/%2f%2fattacker.example/path", fallback);
    assert.equal(new URL(candidate, "https://app.nantty.com").origin, "https://app.nantty.com");
  });
});
