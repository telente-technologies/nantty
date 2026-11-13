import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { POST } from "@/app/bff/auth/social/route";
import { readWebappOrigin } from "@/config/webappEnvironment.config";

interface SeenSignInRequest {
  readonly path: string;
  readonly body: Record<string, unknown>;
}

const environmentBeforeTest = {
  useMocks: process.env.WEBAPP_USE_MOCKS,
  apiUrl: process.env.WEBAPP_API_URL,
};
let gateway: Server;
let seenRequests: SeenSignInRequest[] = [];

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    request.on("end", () => resolve(body));
  });
}

before(async () => {
  gateway = createServer(async (request, response) => {
    const body = await readBody(request);
    seenRequests.push({ path: new URL(request.url ?? "/", "http://gateway").pathname, body: JSON.parse(body) as Record<string, unknown> });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      accessToken: "verified-access-token",
      refreshToken: "verified-refresh-token",
      user: { id: "viewer-1", username: "ada", name: "Ada" },
    }));
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, { WEBAPP_USE_MOCKS: "false", WEBAPP_API_URL: `http://127.0.0.1:${(gateway.address() as AddressInfo).port}` });
});

after(async () => {
  await new Promise<void>((resolve, reject) => gateway.close((error) => error ? reject(error) : resolve()));
  if (environmentBeforeTest.useMocks === undefined) Reflect.deleteProperty(process.env, "WEBAPP_USE_MOCKS");
  else Object.assign(process.env, { WEBAPP_USE_MOCKS: environmentBeforeTest.useMocks });
  if (environmentBeforeTest.apiUrl === undefined) Reflect.deleteProperty(process.env, "WEBAPP_API_URL");
  else Object.assign(process.env, { WEBAPP_API_URL: environmentBeforeTest.apiUrl });
});

function socialRequest(body: Record<string, unknown>): NextRequest {
  const origin = readWebappOrigin();
  return new NextRequest(`${origin}/bff/auth/social`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("web social sign-in BFF route", () => {
  it("forwards Apple's identityToken and birthday using the Apple backend contract", async () => {
    seenRequests = [];
    const response = await POST(socialRequest({
      provider: "apple",
      identityToken: "apple.signed.identity.token",
      nonce: "apple-nonce",
      birthday: "1990-05-05",
      fullName: { givenName: "Ada", familyName: "Lovelace" },
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(seenRequests, [{
      path: "/api/v1/auth/apple",
      body: {
        identityToken: "apple.signed.identity.token",
        nonce: "apple-nonce",
        birthday: "1990-05-05",
        fullName: { givenName: "Ada", familyName: "Lovelace" },
      },
    }]);
  });

  it("continues forwarding Google's idToken using the Google backend contract", async () => {
    seenRequests = [];
    const response = await POST(socialRequest({ provider: "google", idToken: "google.signed.id.token", nonce: "google-nonce" }));

    assert.equal(response.status, 200);
    assert.deepEqual(seenRequests, [{
      path: "/api/v1/auth/google",
      body: { idToken: "google.signed.id.token", nonce: "google-nonce" },
    }]);
  });

  it("rejects impossible calendar dates instead of silently dropping the birthday", async () => {
    seenRequests = [];
    const response = await POST(socialRequest({ provider: "google", idToken: "google.signed.identity.token", birthday: "2025-02-29" }));

    assert.equal(response.status, 400);
    assert.deepEqual(seenRequests, []);
  });

  it("accepts leap-day birthdays only in leap years", async () => {
    seenRequests = [];
    const response = await POST(socialRequest({ provider: "google", idToken: "google.signed.identity.token", birthday: "2024-02-29" }));

    assert.equal(response.status, 200);
    assert.deepEqual(seenRequests[0]?.body, { idToken: "google.signed.identity.token", birthday: "2024-02-29" });
  });
});
