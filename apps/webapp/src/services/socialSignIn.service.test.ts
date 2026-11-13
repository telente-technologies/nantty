import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { signInWithSocialProvider } from "./socialSignIn.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("web social sign-in request", () => {
  it("reuses the verified Google identity and nonce when submitting the birthday", async () => {
    let forwardedBody: unknown;
    globalThis.fetch = async (_input, init) => {
      forwardedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ user: { id: "viewer-google" }, notice: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    await signInWithSocialProvider("google", { idToken: "google-signed-id-token", nonce: "google-nonce" }, "1990-05-05");

    assert.deepEqual(forwardedBody, {
      provider: "google",
      idToken: "google-signed-id-token",
      nonce: "google-nonce",
      birthday: "1990-05-05",
    });
  });

  it("forwards Apple identity, nonce and optional first-sign-in name", async () => {
    let forwardedBody: unknown;
    globalThis.fetch = async (_input, init) => {
      forwardedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ user: { id: "viewer-apple" }, notice: null }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    await signInWithSocialProvider("apple", {
      identityToken: "apple-signed-id-token",
      nonce: "apple-raw-nonce",
      fullName: { givenName: "Ada", familyName: "Lovelace" },
    });

    assert.deepEqual(forwardedBody, {
      provider: "apple",
      identityToken: "apple-signed-id-token",
      nonce: "apple-raw-nonce",
      fullName: { givenName: "Ada", familyName: "Lovelace" },
    });
  });
});
