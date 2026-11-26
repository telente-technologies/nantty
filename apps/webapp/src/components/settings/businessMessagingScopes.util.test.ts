import assert from "node:assert/strict";
import test from "node:test";

import { getGrantableBusinessMessagingScopes, isGrantableBusinessMessagingScope, parseBusinessMessagingConsentRequest } from "./businessMessagingScopes.util";

test("only explicitly supported own scopes can be granted", () => {
  assert.equal(isGrantableBusinessMessagingScope("messages:send"), true);
  assert.equal(isGrantableBusinessMessagingScope("constructor"), false);
  assert.equal(isGrantableBusinessMessagingScope("toString"), false);
  assert.equal(isGrantableBusinessMessagingScope("messages:delete"), false);
});

test("consent link parsing rejects ambiguous and malformed resource identifiers", () => {
  const applicationId = "7f7675e7-70c4-491e-9532-14fa4085db0a";
  const storeId = "8f7675e7-70c4-491e-9532-14fa4085db0a";
  assert.deepEqual(parseBusinessMessagingConsentRequest([applicationId], [storeId]), { applicationId, storeId, authorization: null });
  assert.equal(parseBusinessMessagingConsentRequest([applicationId, applicationId], [storeId]), null);
  assert.equal(parseBusinessMessagingConsentRequest([applicationId], []), null);
  assert.equal(parseBusinessMessagingConsentRequest(["not-a-uuid"], [storeId]), null);
});

test("authorization callback requires one S256 challenge, bounded state and a safe absolute URI", () => {
  const applicationId = "7f7675e7-70c4-491e-9532-14fa4085db0a";
  const storeId = "8f7675e7-70c4-491e-9532-14fa4085db0a";
  const args = [applicationId, storeId, "https://merchant.example/nantty/callback", "A".repeat(43), "S256", "state-value-with-enough-entropy"] as const;
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], [args[2]], [args[3]], [args[4]], [args[5]])?.authorization?.state, args[5]);
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], [args[2]], [args[3]], ["plain"], [args[5]]), null);
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], ["https://evil.example/callback"], [args[3]], [args[4]], [args[5]])?.authorization?.redirectUri, "https://evil.example/callback");
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], [args[2], args[2]], [args[3]], [args[4]], [args[5]]), null);
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], [args[2]], [args[3]], [args[4]], ["short"]), null);
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], ["javascript:alert(1)"], [args[3]], [args[4]], [args[5]]), null);
  assert.equal(parseBusinessMessagingConsentRequest([args[0]], [args[1]], ["https://merchant.example/callback?state=fixed"], [args[3]], [args[4]], [args[5]]), null);
});

test("grantable scope selection filters unknown scopes and removes duplicates", () => {
  assert.deepEqual(
    getGrantableBusinessMessagingScopes(["messages:send", "constructor", "messages:send", "conversations:read"]),
    ["messages:send", "conversations:read"],
  );
});
