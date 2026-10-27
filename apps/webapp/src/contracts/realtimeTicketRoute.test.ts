import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { POST } from "@/app/bff/realtime/route";
import { sessionCookieNames } from "@/config/sessionCookies.config";
import { readWebappOrigin } from "@/config/webappEnvironment.config";
import { readRealtimeConnectOrigin } from "@/server/contentSecurityPolicy.service";
import { createNewSessionId } from "@/server/session.service";
import { deriveCsrfTokenForSession, signPayloadIntoCookieValue } from "@/server/signedCookie.service";

const now = () => Math.floor(Date.now() / 1000);
const jwt = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const accessToken = jwt({ sub: "u_1", exp: now() + 900 });
const expiredAccessToken = jwt({ sub: "u_1", exp: now() - 60 });

let gateway: Server;
let issuedCount = 0;
let answer: { status: number; retryAfter?: string } = { status: 200 };
let refreshSucceeds = true;

before(async () => {
  gateway = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://gateway").pathname;
    response.setHeader("content-type", "application/json");
    request.resume();
    if (path === "/api/v1/auth/refresh") {
      response.statusCode = refreshSucceeds ? 200 : 401;
      response.end(JSON.stringify(refreshSucceeds ? { accessToken, refreshToken: "rotated-refresh", expiresIn: 900 } : { code: "INVALID_REFRESH_TOKEN" }));
      return;
    }
    if (path !== "/api/v1/auth/realtime-token") return void response.end("{}");
    if (request.headers.authorization === `Bearer ${expiredAccessToken}` || answer.status === 401) {
      response.statusCode = 401;
      return void response.end(JSON.stringify({ code: "UNAUTHENTICATED" }));
    }
    issuedCount += 1;
    response.statusCode = answer.status;
    if (answer.retryAfter) response.setHeader("retry-after", answer.retryAfter);
    response.end(JSON.stringify(answer.status === 200 ? { realtimeToken: jwt({ sub: "u_1", scope: "realtime", exp: now() + 300, n: issuedCount }), expiresIn: 300, scope: "realtime" } : { code: "RATE_LIMITED" }));
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, { WEBAPP_USE_MOCKS: "false", WEBAPP_API_URL: `http://127.0.0.1:${(gateway.address() as AddressInfo).port}` });
});

after(() => new Promise<void>((resolve) => gateway.close(() => resolve())));

beforeEach(() => {
  issuedCount = 0;
  answer = { status: 200 };
  refreshSucceeds = true;
  Object.assign(process.env, { WEBAPP_USE_MOCKS: "false" });
});

function ticketRequest(options: { readonly sessionId?: string | null; readonly csrf?: boolean; readonly fresh?: boolean; readonly cookies?: Record<string, string>; readonly access?: string } = {}) {
  const sessionId = options.sessionId === undefined ? createNewSessionId() : options.sessionId;
  const cookies: Record<string, string> = { ...(options.cookies ?? {}) };
  if (sessionId) {
    cookies[sessionCookieNames.sessionId] = signPayloadIntoCookieValue(sessionId, "session-id", 3600);
    cookies[sessionCookieNames.accessToken] ??= options.access ?? accessToken;
    cookies[sessionCookieNames.refreshToken] ??= "refresh-1";
  }
  const headers = new Headers({ origin: readWebappOrigin(), "content-type": "application/json", cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ") });
  if (sessionId && options.csrf !== false) headers.set("x-csrf-token", deriveCsrfTokenForSession(sessionId));
  return { sessionId, request: new NextRequest(`${readWebappOrigin()}/bff/realtime`, { method: "POST", headers, body: JSON.stringify({ fresh: options.fresh === true }) }) };
}

describe("webapp realtime ticket route", () => {
  it("refuses without a session, without CSRF proof, and is a no-op in mock mode", async () => {
    assert.equal((await POST(ticketRequest({ sessionId: null }).request)).status, 401);
    assert.equal((await POST(ticketRequest({ csrf: false }).request)).status, 403);
    Object.assign(process.env, { WEBAPP_USE_MOCKS: "true" });
    const mocked = await POST(ticketRequest().request);
    assert.equal(mocked.status, 404);
    assert.equal(((await mocked.json()) as { code: string }).code, "REALTIME_UNAVAILABLE");
    assert.equal(issuedCount, 0);
  });

  it("issues a short-lived ticket, caches it in a signed httpOnly cookie and reuses it until a fresh one is asked for", async () => {
    const first = ticketRequest();
    const issued = await POST(first.request);
    assert.equal(issued.status, 200);
    const body = (await issued.json()) as { url: string; realtimeToken: string };
    assert.match(body.url, /^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const cookie = issued.cookies.get(sessionCookieNames.realtimeTicket);
    assert.ok(cookie?.value && cookie.httpOnly, "ticket cache cookie is httpOnly");
    assert.notEqual(cookie.value, body.realtimeToken, "the cookie holds a signed envelope, not the bare ticket");
    assert.equal(issued.headers.get("cache-control"), "no-store");

    const reused = await POST(ticketRequest({ sessionId: first.sessionId, cookies: { [sessionCookieNames.realtimeTicket]: cookie.value } }).request);
    assert.equal(((await reused.json()) as { realtimeToken: string }).realtimeToken, body.realtimeToken);
    assert.equal(issuedCount, 1);

    const otherSession = await POST(ticketRequest({ cookies: { [sessionCookieNames.realtimeTicket]: cookie.value } }).request);
    assert.notEqual(((await otherSession.json()) as { realtimeToken: string }).realtimeToken, body.realtimeToken, "another session never gets this ticket");

    const fresh = await POST(ticketRequest({ sessionId: first.sessionId, fresh: true, cookies: { [sessionCookieNames.realtimeTicket]: cookie.value } }).request);
    assert.notEqual(((await fresh.json()) as { realtimeToken: string }).realtimeToken, body.realtimeToken);
    assert.equal(issuedCount, 3);
  });

  it("passes 429 through with Retry-After and caches nothing", async () => {
    answer = { status: 429, retryAfter: "7" };
    const limited = await POST(ticketRequest().request);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "7");
    assert.equal(limited.cookies.get(sessionCookieNames.realtimeTicket), undefined);
  });

  it("rotates an expired access token, and ends the session when refresh fails", async () => {
    const rotated = await POST(ticketRequest({ access: expiredAccessToken }).request);
    assert.equal(rotated.status, 200);
    assert.equal(rotated.cookies.get(sessionCookieNames.refreshToken)?.value, "rotated-refresh");

    refreshSucceeds = false;
    answer = { status: 401 };
    const ended = await POST(ticketRequest().request);
    assert.equal(ended.status, 401);
    assert.equal(((await ended.json()) as { code: string }).code, "SESSION_EXPIRED");
    assert.equal(ended.cookies.get(sessionCookieNames.sessionId)?.value, "");
  });

  it("allows the realtime origin in connect-src from config", () => {
    assert.equal(readRealtimeConnectOrigin("wss://rt.nantty.com/ws", undefined), "wss://rt.nantty.com");
    assert.equal(readRealtimeConnectOrigin(undefined, "https://api.nantty.com"), "wss://api.nantty.com");
    assert.equal(readRealtimeConnectOrigin("not a url", undefined), "");
  });
});
