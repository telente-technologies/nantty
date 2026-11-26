import assert from "node:assert/strict";
import test from "node:test";

import { getGrantableBusinessMessagingScopes, isGrantableBusinessMessagingScope } from "./businessMessagingScopes.util";

test("only explicitly supported own scopes can be granted", () => {
  assert.equal(isGrantableBusinessMessagingScope("messages:send"), true);
  assert.equal(isGrantableBusinessMessagingScope("constructor"), false);
  assert.equal(isGrantableBusinessMessagingScope("toString"), false);
  assert.equal(isGrantableBusinessMessagingScope("messages:delete"), false);
});

test("grantable scope selection filters unknown scopes and removes duplicates", () => {
  assert.deepEqual(
    getGrantableBusinessMessagingScopes(["messages:send", "constructor", "messages:send", "conversations:read"]),
    ["messages:send", "conversations:read"],
  );
});
