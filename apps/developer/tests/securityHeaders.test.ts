import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "../src/proxy";
import config from "../next.config";

test("developer portal configures strict security headers and no-store API headers", async () => {
  assert.equal(config.poweredByHeader, false);
  const rules = await config.headers?.();
  assert.ok(rules && rules.length >= 2);
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");
  assert.ok(globalRule);
  assert.ok(apiRule);

  const globalHeaders = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(globalHeaders.has("content-security-policy"), false);
  assert.equal(globalHeaders.get("strict-transport-security"), "max-age=63072000; includeSubDomains; preload");
  assert.equal(globalHeaders.get("x-frame-options"), "DENY");
  assert.equal(globalHeaders.get("x-content-type-options"), "nosniff");
  assert.equal(globalHeaders.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(globalHeaders.get("cross-origin-resource-policy"), "same-origin");

  const apiHeaders = new Map(apiRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(apiHeaders.get("cache-control"), "no-store");
  assert.equal(apiHeaders.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("developer portal uses a per-request CSP nonce without unsafe inline scripts", () => {
  const request = new NextRequest("https://developer.nantty.com/dashboard");
  const response = proxy(request);
  const policy = response.headers.get("content-security-policy") ?? "";
  const nonce = response.headers.get("x-middleware-request-x-nonce");

  assert.match(policy, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  assert.equal(policy.includes("script-src 'self' 'unsafe-inline'"), false);
  assert.ok(nonce);
  assert.ok(policy.includes(`'nonce-${nonce}'`));
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
});
