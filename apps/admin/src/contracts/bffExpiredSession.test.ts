import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { sessionCookieNames } from "@/config/sessionCookies.config";
import { isAccessTokenKnownExpired } from "@/server/accessTokenExpiry.service";
import { forwardBffRequestToAdminApi } from "@/server/bffGateway.service";
import { signPayloadIntoCookieValue } from "@/server/signedCookie.service";

const now = () => Math.floor(Date.now() / 1000);
const jwt = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const expiredToken = jwt({ sub: "u_1", exp: now() - 60 });
const freshToken = jwt({ sub: "u_1", exp: now() + 900 });

let gateway: Server;
let seen: { readonly path: string; readonly authorization: string | undefined }[] = [];
let refreshSucceeds = true;

before(async () => {
  gateway = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://gateway").pathname;
    seen.push({ path, authorization: request.headers.authorization });
    request.resume();
    response.setHeader("content-type", "application/json");
    if (path.endsWith("/auth/refresh")) {
      response.statusCode = refreshSucceeds ? 200 : 401;
      response.end(JSON.stringify(refreshSucceeds ? { accessToken: freshToken, refreshToken: "rotated-refresh", expiresIn: 900 } : { code: "INVALID_REFRESH_TOKEN" }));
      return;
    }
    response.statusCode = request.headers.authorization === `Bearer ${expiredToken}` ? 401 : 200;
    response.end("{}");
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  process.env.ADMIN_USE_MOCKS = "false";
  process.env.ADMIN_API_URL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});

after(() => {
  gateway.close();
});

function requestWithExpiredToken(): NextRequest {
  const sessionId = "session-under-test";
  const cookies: Record<string, string> = {
    [sessionCookieNames.session]: signPayloadIntoCookieValue({ sessionId, startedAtEpochSeconds: now() }, "admin-session", 3600),
    [sessionCookieNames.sessionView]: signPayloadIntoCookieValue({ sessionId, admin: { id: "adm_1", email: "a@nantty.com", name: "A", role: "superadmin", permissions: [] }, lastActivityAtEpochSeconds: now(), verifiedAtEpochSeconds: now() }, "admin-session-view", 900),
    [sessionCookieNames.accessToken]: expiredToken,
    [sessionCookieNames.refreshToken]: "refresh-token",
  };
  const cookie = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
  return new NextRequest(`http://localhost/bff/admin/account`, { headers: { cookie } });
}

const segments = "/admin/account".split("/").filter(Boolean);

describe("admin BFF with an expired access token", () => {
  beforeEach(() => {
    seen = [];
    refreshSucceeds = true;
  });

  it("recognises the expired token", () => {
    assert.equal(isAccessTokenKnownExpired(expiredToken), true);
    assert.equal(isAccessTokenKnownExpired(freshToken), false);
  });

  it("refreshes first and never forwards the expired token", async () => {
    await forwardBffRequestToAdminApi(requestWithExpiredToken(), segments);
    assert.ok(seen.length > 0);
    assert.ok(seen.every((request) => request.authorization !== `Bearer ${expiredToken}`), JSON.stringify(seen));
    assert.equal(seen.filter((request) => request.path.endsWith("/auth/refresh")).length, 1);
  });

  it("ends the session with SESSION_EXPIRED when the refresh fails, before calling the API", async () => {
    refreshSucceeds = false;
    const response = await forwardBffRequestToAdminApi(requestWithExpiredToken(), segments);
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as { code: string }).code, "SESSION_EXPIRED");
    assert.deepEqual(seen.map((request) => request.path.endsWith("/auth/refresh")), [true]);
    assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${sessionCookieNames.accessToken}=;`)), response.headers.getSetCookie().join(" | "));
  });
});
