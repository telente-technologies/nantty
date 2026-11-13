import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/errors/api.error";

import { authMocks } from "./auth.mock";

describe("social sign-in mock birthday challenge", () => {
  for (const [provider, path, tokenField, tokenName] of [
    ["google", "/api/v1/auth/google", "idToken", "header.payload.signature"],
    ["apple", "/api/v1/auth/apple", "identityToken", "header.payload.signature"],
  ] as const) {
    it(`requires birthday for a new ${provider} account and completes on retry`, () => {
      const route = authMocks.find((candidate) => candidate.method === "POST" && candidate.path === path);
      assert.ok(route);
      const body = { [tokenField]: tokenName };

      assert.throws(
        () => route.handler({ params: {}, query: new URLSearchParams(), body }),
        (error: unknown) => error instanceof ApiError && error.code === "BIRTHDAY_REQUIRED",
      );

      const session = route.handler({ params: {}, query: new URLSearchParams(), body: { ...body, birthday: "1990-05-05" } });
      assert.equal(typeof session, "object");
      assert.ok(session && typeof session === "object" && "user" in session);
    });
  }
});
