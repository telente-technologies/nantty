import { createHmac } from "node:crypto";

import { createResponseContext, type HttpMiddlewareContext, type HttpRequestContext } from "@zudojs/http";
import { describe, expect, it } from "vitest";

import { createGatewayIdentityMiddleware, readGatewayIdentitySecretsFromEnvironment } from "../../src/middlewares/gatewayIdentity.middleware.js";

const secret = "test-gateway-identity-secret-0123456789abcdef";
const previous = "older-gateway-identity-secret-0123456789abcdef";
const accountId = "0190a0b0-0000-7000-8000-000000000001";
const nowMs = 1_800_000_000_000;

function sign(key: string, headers: Record<string, string>, issuedAt: number, method = "GET", path = "/api/v1/me"): string {
  const payload = ["v1", String(issuedAt), method, path, headers["x-request-id"] ?? "", ...["x-zudomart-account-id", "x-zudomart-session-id", "x-zudomart-age-bracket", "x-zudomart-viewer"].map((name) => headers[name] ?? "")].join("\n");
  return `t=${issuedAt},v1=${createHmac("sha256", key).update(payload).digest("hex")}`;
}

function signedHeaders(key = secret, issuedAt = nowMs / 1000): Record<string, string> {
  const headers: Record<string, string> = { "x-request-id": "req-1", "x-zudomart-account-id": accountId, "x-zudomart-session-id": "s1", "x-zudomart-age-bracket": "adult" };
  return { ...headers, "x-zudomart-identity-signature": sign(key, headers, issuedAt) };
}

async function statusFor(headers: Record<string, string>, method = "GET", path = "/api/v1/me"): Promise<number> {
  const request = { method, path, url: path, getHeader: (name: string) => headers[name.toLowerCase()] } as unknown as HttpRequestContext;
  const middleware = createGatewayIdentityMiddleware([secret, previous], () => nowMs);
  const response = await middleware({ request } as unknown as HttpMiddlewareContext, async () => createResponseContext({ status: 204 }));
  return (response as { status: number }).status;
}

describe("gateway identity middleware", () => {
  it("accepts a fresh gateway signature, including one made with the previous secret", async () => {
    expect(await statusFor(signedHeaders())).toBe(204);
    expect(await statusFor(signedHeaders(previous))).toBe(204);
  });

  it("lets anonymous requests without identity headers through as guests", async () => {
    expect(await statusFor({})).toBe(204);
  });

  it("rejects an unsigned identity header sent straight to the service", async () => {
    expect(await statusFor({ "x-zudomart-account-id": accountId })).toBe(401);
    expect(await statusFor({ "x-zudomart-age-bracket": "adult" })).toBe(401);
  });

  it("rejects expired, forged, tampered and replayed context", async () => {
    expect(await statusFor(signedHeaders(secret, nowMs / 1000 - 61))).toBe(401);
    expect(await statusFor(signedHeaders("attacker-chosen-secret-0123456789abcdef"))).toBe(401);
    expect(await statusFor({ ...signedHeaders(), "x-zudomart-account-id": "0190a0b0-0000-7000-8000-000000000002" })).toBe(401);
    expect(await statusFor({ ...signedHeaders(), "x-zudomart-age-bracket": "minor" })).toBe(401);
    expect(await statusFor(signedHeaders(), "DELETE")).toBe(401);
    expect(await statusFor(signedHeaders(), "GET", "/api/v1/other")).toBe(401);
  });

  it("requires a long secret in the environment", () => {
    const problems: string[] = [];
    const saved = process.env["GATEWAY_IDENTITY_SECRET"];
    process.env["GATEWAY_IDENTITY_SECRET"] = "short";
    expect(readGatewayIdentitySecretsFromEnvironment(problems)).toEqual([]);
    expect(problems).toHaveLength(1);
    if (saved === undefined) delete process.env["GATEWAY_IDENTITY_SECRET"];
    else process.env["GATEWAY_IDENTITY_SECRET"] = saved;
  });
});
