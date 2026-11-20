import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { NextRequest } from "next/server";

import {
  forwardDeveloperLogoutRequest,
  forwardDeveloperPasswordLoginRequest,
  forwardDeveloperRegisterRequest,
  forwardDeveloperUsernameAvailabilityRequest,
} from "../src/server/developerAuthProxy";

const originalNodeEnv = process.env.NODE_ENV;
const originalApiBaseUrl = process.env.DEVELOPER_API_BASE_URL;
const originalFetch = globalThis.fetch;

function setNodeEnvironment(value: string): void {
  Reflect.set(process.env, "NODE_ENV", value);
}

afterEach(() => {
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else setNodeEnvironment(originalNodeEnv);
  if (originalApiBaseUrl === undefined) delete process.env.DEVELOPER_API_BASE_URL;
  else process.env.DEVELOPER_API_BASE_URL = originalApiBaseUrl;
  globalThis.fetch = originalFetch;
});

test("rejects cross-origin register requests without calling Identity", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({});
  };

  const request = new NextRequest("https://developers.nantty.test/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.test" },
    body: JSON.stringify({ email: "dev@example.com", birthday: "1996-05-10", password: "password123", otpToken: "otp-jwt" }),
  });

  const response = await forwardDeveloperRegisterRequest(request);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "CSRF_REJECTED");
  assert.equal(upstreamCalls, 0);
});

test("register creates session cookie without exposing tokens in JSON body", async () => {
  setNodeEnvironment("production");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let capturedPath = "";
  globalThis.fetch = async (input) => {
    capturedPath = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url).pathname;
    return Response.json(
      {
        accessToken: "jwt-access-token-value",
        refreshToken: "refresh-token-value",
        expiresIn: 900,
        tokenType: "Bearer",
        isNewUser: true,
        user: { id: "user-1", email: "dev@example.com", name: "Ada Okafor" },
      },
      { status: 201 },
    );
  };

  const request = new NextRequest("https://developers.nantty.test/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://developers.nantty.test" },
    body: JSON.stringify({
      email: "DEV@Example.com",
      birthday: "1996-05-10",
      password: "secure-password-123",
      username: "ada.okafor",
      name: "Ada Okafor",
      otpToken: "verified-otp-token",
    }),
  });

  const response = await forwardDeveloperRegisterRequest(request);
  assert.equal(response.status, 201);
  assert.equal(capturedPath, "/api/v1/auth/register");
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.authenticated, true);
  assert.equal(body.isNewUser, true);
  assert.equal("accessToken" in body, false);
  assert.equal("refreshToken" in body, false);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /__Host-zd_at=jwt-access-token-value/);
  assert.match(setCookie, /HttpOnly/);
});

test("password login sets HttpOnly cookie and strips upstream tokens", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let capturedPath = "";
  globalThis.fetch = async (input) => {
    capturedPath = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url).pathname;
    return Response.json({
      accessToken: "dev-access-jwt",
      refreshToken: "dev-refresh-jwt",
      expiresIn: 600,
      user: { id: "user-2", username: "ada" },
    });
  };

  const request = new NextRequest("https://developers.nantty.test/api/auth/password-login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://developers.nantty.test" },
    body: JSON.stringify({ identifier: "ada", password: "secure-password-123" }),
  });

  const response = await forwardDeveloperPasswordLoginRequest(request);
  assert.equal(response.status, 200);
  assert.equal(capturedPath, "/api/v1/auth/login");
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.authenticated, true);
  assert.equal("accessToken" in body, false);
  assert.match(response.headers.get("set-cookie") ?? "", /zd_webapp_at=dev-access-jwt/);
});

test("username availability checks upstream Identity endpoint", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let capturedQuery = "";
  globalThis.fetch = async (input) => {
    capturedQuery = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url).search;
    return Response.json({ available: true });
  };

  const request = new NextRequest("https://developers.nantty.test/api/auth/username-available?username=Ada.Dev&name=Ada");
  const response = await forwardDeveloperUsernameAvailabilityRequest(request);
  assert.equal(response.status, 200);
  assert.equal(capturedQuery, "?username=ada.dev&name=Ada");
  assert.deepEqual(await response.json(), { available: true });
});

test("logout rejects cross-site mutations and revokes the upstream Identity session before clearing the cookie", async () => {
  setNodeEnvironment("production");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let capturedAuth = "";
  let capturedPath = "";
  globalThis.fetch = async (input, init) => {
    capturedPath = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url).pathname;
    capturedAuth = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ revoked: true });
  };

  const crossSite = new NextRequest("https://developers.nantty.test/api/auth/logout", {
    method: "POST",
    headers: { origin: "https://developers.nantty.test", "sec-fetch-site": "cross-site" },
  });
  const blocked = await forwardDeveloperLogoutRequest(crossSite);
  assert.equal(blocked.status, 403);
  assert.equal(capturedPath, "");

  const valid = new NextRequest("https://developers.nantty.test/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "https://developers.nantty.test",
      "sec-fetch-site": "same-origin",
      cookie: "__Host-zd_at=active-jwt-token",
    },
  });
  const response = await forwardDeveloperLogoutRequest(valid);
  assert.equal(response.status, 200);
  assert.equal(capturedPath, "/api/v1/auth/logout");
  assert.equal(capturedAuth, "Bearer active-jwt-token");
  assert.match(response.headers.get("set-cookie") ?? "", /__Host-zd_at=;/);
});
