import crypto from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { createPkceChallengePair, handleSsoCallback, readDeveloperSsoConfig, safeReturnPath } from "../src/server/developerSso";

async function withSsoConfig(run: () => Promise<void>): Promise<void> {
  const keys = ["DEVELOPER_API_BASE_URL", "DEVELOPER_SSO_AUTHORIZE_URL", "DEVELOPER_SSO_CLIENT_ID", "DEVELOPER_SSO_CLIENT_SECRET", "DEVELOPER_SSO_REDIRECT_URI"] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.DEVELOPER_API_BASE_URL = "https://api.nantty.example";
  process.env.DEVELOPER_SSO_AUTHORIZE_URL = "https://api.nantty.example";
  process.env.DEVELOPER_SSO_CLIENT_ID = "developer";
  process.env.DEVELOPER_SSO_CLIENT_SECRET = "test-only-secret";
  process.env.DEVELOPER_SSO_REDIRECT_URI = "https://developers.nantty.example/api/auth/callback";
  try {
    await run();
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
}

function callbackRequest(state: string, cookieState = state): NextRequest {
  const request = new NextRequest(`https://developers.nantty.example/api/auth/callback?code=one-time-code&state=${state}`);
  request.cookies.set("zd_sso_pkce", JSON.stringify({ verifier: "test-verifier", state: cookieState, returnTo: "/dashboard" }));
  return request;
}

describe("developerSso", () => {
  it("fails closed when SSO environment configuration is absent", () => {
    delete process.env.DEVELOPER_SSO_CLIENT_ID;
    delete process.env.DEVELOPER_SSO_CLIENT_SECRET;
    assert.equal(readDeveloperSsoConfig(), null);
  });

  it("creates valid S256 PKCE verifier/challenge pairs", () => {
    const pair = createPkceChallengePair();
    const expected = crypto.createHash("sha256").update(pair.verifier).digest("base64url");
    assert.equal(pair.challenge, expected);
    assert.ok(pair.state.length > 20);
  });

  it("keeps return paths on the developer origin after URL normalization", () => {
    assert.equal(safeReturnPath("/settings?tab=security#keys"), "/settings?tab=security#keys");
    for (const path of ["//evil.example", "/\\evil.example", "/\t/evil.example", "https://evil.example"]) {
      assert.equal(safeReturnPath(path), "/dashboard");
    }
  });

  it("rejects mismatched state before token exchange", async () => withSsoConfig(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("fetch should not be called"); };
    try {
      const response = await handleSsoCallback(callbackRequest("expected", "different"));
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "SSO_STATE_MISMATCH");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }));

  it("reports an unavailable Identity service without setting an access cookie", async () => withSsoConfig(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("network unavailable"); };
    try {
      const response = await handleSsoCallback(callbackRequest("expected"));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "SSO_IDENTITY_UNAVAILABLE");
      assert.equal(response.cookies.get("zd_webapp_at"), undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }));

  it("bounds the issued cookie and redirects only after a valid token response", async () => withSsoConfig(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      return Response.json({ accessToken: "test-only-token", expiresIn: 100_000 });
    };
    try {
      const response = await handleSsoCallback(callbackRequest("expected"));
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "https://developers.nantty.example/dashboard");
      assert.equal(response.cookies.get("zd_webapp_at")?.value, "test-only-token");
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=900/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }));
});
