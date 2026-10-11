import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { sessionCookieNames } from "@/config/sessionCookies.config";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { forwardBffRequestToWebappApi } from "@/server/gateway.service";
import { createNewSessionId } from "@/server/session.service";
import { signPayloadIntoCookieValue } from "@/server/signedCookie.service";
import { decideSessionExpiredAction } from "@/utils/sessionExpiry.util";

const now = () => Math.floor(Date.now() / 1000);
const jwt = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const expiredToken = jwt({ sub: "u_1", exp: now() - 60 });
const revokedToken = jwt({ sub: "u_1", exp: now() + 600, revoked: true });
const freshToken = jwt({ sub: "u_1", exp: now() + 900 });

interface SeenRequest {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
}

let gateway: Server;
let seen: SeenRequest[] = [];
let refreshSucceeds = true;

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let text = "";
    request.on("data", (chunk: Buffer) => (text += chunk.toString("utf8")));
    request.on("end", () => resolve(text));
  });

before(async () => {
  gateway = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://gateway").pathname;
    const authorization = request.headers.authorization;
    seen.push({ method: request.method ?? "GET", path, authorization });
    response.setHeader("content-type", "application/json");
    if (path === "/api/v1/auth/refresh") {
      await readBody(request);
      response.statusCode = refreshSucceeds ? 200 : 401;
      response.end(JSON.stringify(refreshSucceeds ? { accessToken: freshToken, refreshToken: "rotated-refresh", expiresIn: 900 } : { code: "INVALID_REFRESH_TOKEN", message: "Sign in again." }));
      return;
    }
    const token = authorization?.replace(/^Bearer /, "");
    if (token === expiredToken || token === revokedToken) {
      response.statusCode = 401;
      response.end(JSON.stringify({ code: "UNAUTHENTICATED", message: "Sign in to continue." }));
      return;
    }
    response.end(JSON.stringify({ path, signedIn: token === freshToken }));
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, { WEBAPP_USE_MOCKS: "false", WEBAPP_API_URL: `http://127.0.0.1:${(gateway.address() as AddressInfo).port}` });
});

after(() => {
  gateway.close();
});

function signedInRequest(apiPath: string, accessToken: string): NextRequest {
  const sessionId = createNewSessionId();
  const cookies = {
    [sessionCookieNames.sessionId]: signPayloadIntoCookieValue(sessionId, "session-id", 3600),
    [sessionCookieNames.viewer]: signPayloadIntoCookieValue({ sessionId, user: { id: "u_1", username: "ada", name: "Ada" } }, "viewer", 300),
    [sessionCookieNames.accessToken]: accessToken,
    [sessionCookieNames.refreshToken]: "refresh-token",
  };
  const cookie = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
  return new NextRequest(`http://localhost:3500/bff${apiPath}`, { headers: { cookie } });
}

const segments = (apiPath: string) => apiPath.split("/").filter(Boolean);
const clearedCookieNames = (response: Response) =>
  response.headers.getSetCookie().filter((cookie) => /=;|Max-Age=0/i.test(cookie)).map((cookie) => cookie.split("=")[0]);

describe("BFF with an expired access token", () => {
  beforeEach(() => {
    seen = [];
    refreshSucceeds = true;
  });

  it("knows an expired token from its exp claim and ignores tokens it cannot read", () => {
    assert.equal(isAccessTokenKnownExpired(expiredToken), true);
    assert.equal(isAccessTokenKnownExpired(freshToken), false);
    assert.equal(isAccessTokenKnownExpired("opaque-token"), false);
    assert.equal(isAccessTokenKnownExpired(null), false);
  });

  it("refreshes before forwarding, never sends the expired token, and stores the new pair", async () => {
    const response = await forwardBffRequestToWebappApi(signedInRequest("/api/v1/notifications", expiredToken), segments("/api/v1/notifications"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: "/api/v1/notifications", signedIn: true });
    assert.ok(seen.every((request) => request.authorization !== `Bearer ${expiredToken}`), JSON.stringify(seen));
    assert.equal(seen.filter((request) => request.path === "/api/v1/auth/refresh").length, 1);
    assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${sessionCookieNames.accessToken}=${freshToken}`)));
  });

  it("continues anonymously on a public read when the refresh fails, and clears the session", async () => {
    refreshSucceeds = false;
    const apiPath = "/api/v1/legal/policy-versions/current";
    const response = await forwardBffRequestToWebappApi(signedInRequest(apiPath, expiredToken), segments(apiPath));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path: apiPath, signedIn: false });
    const forwarded = seen.filter((request) => request.path === apiPath);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0]?.authorization, undefined);
    assert.ok(clearedCookieNames(response).includes(sessionCookieNames.sessionId));
  });

  it("answers SESSION_EXPIRED on a member-only route when the refresh fails, without calling it", async () => {
    refreshSucceeds = false;
    const response = await forwardBffRequestToWebappApi(signedInRequest("/api/v1/users/me/policy-acceptances", expiredToken), segments("/api/v1/users/me/policy-acceptances"));
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as { code: string }).code, "SESSION_EXPIRED");
    assert.deepEqual(seen.map((request) => request.path), ["/api/v1/auth/refresh"]);
    assert.ok(clearedCookieNames(response).includes(sessionCookieNames.accessToken));
  });

  it("retries a public read anonymously when the gateway rejects an unexpired token and the refresh fails", async () => {
    refreshSucceeds = false;
    const response = await forwardBffRequestToWebappApi(signedInRequest("/api/v1/products", revokedToken), segments("/api/v1/products"));
    assert.equal(response.status, 200);
    assert.deepEqual(seen.map((request) => [request.path, request.authorization === undefined]), [["/api/v1/products", false], ["/api/v1/auth/refresh", true], ["/api/v1/products", true]]);
    assert.ok(clearedCookieNames(response).includes(sessionCookieNames.refreshToken));
  });
});

describe("client reaction to SESSION_EXPIRED", () => {
  it("sends member-only pages to sign-in and back, and only prompts on pages a guest may browse", () => {
    assert.deepEqual(decideSessionExpiredAction("/notifications"), { kind: "redirect", href: "/login?next=%2Fnotifications" });
    assert.deepEqual(decideSessionExpiredAction("/orders/o_1", "?tab=items"), { kind: "redirect", href: "/login?next=%2Forders%2Fo_1%3Ftab%3Ditems" });
    assert.deepEqual(decideSessionExpiredAction("/explore"), { kind: "prompt" });
    assert.deepEqual(decideSessionExpiredAction("/login"), { kind: "prompt" });
  });
});
