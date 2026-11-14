import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../api/apiError";
import { isTerminalSessionFailure } from "./sessionFailure.util";

test("expired and revoked sessions require local sensitive-state cleanup", () => {
  assert.equal(isTerminalSessionFailure(new ApiError("expired", 401)), true);
  assert.equal(isTerminalSessionFailure(new ApiError("revoked", 403)), true);
});

test("transient server and network errors do not clear the local session", () => {
  assert.equal(isTerminalSessionFailure(new ApiError("temporary", 503)), false);
  assert.equal(isTerminalSessionFailure(new ApiError("offline", null, "NETWORK_ERROR")), false);
  assert.equal(isTerminalSessionFailure(new Error("unexpected")), false);
});
