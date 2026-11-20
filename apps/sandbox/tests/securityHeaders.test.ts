import assert from "node:assert/strict";
import { test } from "node:test";

import config from "../next.config";

test("sandbox portal configures strict security headers and no-store API headers", async () => {
  assert.equal(config.poweredByHeader, false);
  const rules = await config.headers?.();
  assert.ok(rules && rules.length >= 2);
  const globalRule = rules.find((rule) => rule.source === "/:path*");
  const apiRule = rules.find((rule) => rule.source === "/api/:path*");
  assert.ok(globalRule);
  assert.ok(apiRule);

  const globalHeaders = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.ok(globalHeaders.get("content-security-policy")?.includes("frame-ancestors 'none'"));
  assert.ok(globalHeaders.get("content-security-policy")?.includes("object-src 'none'"));
  assert.equal(globalHeaders.get("strict-transport-security"), "max-age=63072000; includeSubDomains; preload");
  assert.equal(globalHeaders.get("x-frame-options"), "DENY");
  assert.equal(globalHeaders.get("x-content-type-options"), "nosniff");
  assert.equal(globalHeaders.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(globalHeaders.get("cross-origin-resource-policy"), "same-origin");

  const apiHeaders = new Map(apiRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(apiHeaders.get("cache-control"), "no-store");
  assert.equal(apiHeaders.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});
