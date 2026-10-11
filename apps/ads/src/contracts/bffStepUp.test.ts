import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { sessionCookieNames } from "@/config/sessionCookies.config";
import { forwardBffRequestToAdsApi } from "@/server/bffGateway.service";
import { signPayloadIntoCookieValue } from "@/server/signedCookie.service";

const freshToken = `e30.${Buffer.from(JSON.stringify({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url")}.sig`;
const stepUpToken = `eyJ.${"s".repeat(700)}.sig`;
let gateway: Server;
let seen: { readonly path: string; readonly stepUp: string | undefined }[] = [];

before(async () => {
  gateway = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://gateway").pathname;
    seen.push({ path, stepUp: request.headers["x-step-up-token"] as string | undefined });
    request.resume();
    response.setHeader("content-type", "application/json");
    if (path.endsWith("/wallets/me")) {
      response.statusCode = 401;
      response.end(JSON.stringify({ code: "STEP_UP_REUSED", message: "This confirmation was already used." }));
      return;
    }
    response.statusCode = 200;
    if (path.endsWith("/ads/memberships")) response.end(JSON.stringify({ data: [] }));
    else if (path.endsWith("/users/me")) response.end(JSON.stringify({ id: "u_1", name: "Ada", username: "ada", email: "ada@example.com", avatarUrl: null }));
    else response.end("{}");
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  process.env.ADS_USE_MOCKS = "false";
  process.env.ADS_API_URL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});

after(() => {
  gateway.close();
});

describe("ads BFF and user step-up", () => {
  it("forwards a full-length step-up token and does not treat STEP_UP_REUSED as an expired session", async () => {
    const cookies: Record<string, string> = {
      [sessionCookieNames.sessionId]: signPayloadIntoCookieValue("session-step-up", "ads-session-id", 3600),
      [sessionCookieNames.accessToken]: freshToken,
      [sessionCookieNames.refreshToken]: "refresh-token",
    };
    const cookie = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
    const request = new NextRequest("http://localhost/bff/wallets/me", { headers: { cookie, "x-step-up-token": stepUpToken } });
    const response = await forwardBffRequestToAdsApi(request, ["wallets", "me"]);
    const walletCalls = seen.filter((call) => call.path.endsWith("/wallets/me"));
    assert.equal(walletCalls.length, 1, JSON.stringify(seen.map((call) => call.path)));
    assert.equal(walletCalls[0]?.stepUp, stepUpToken);
    assert.equal(seen.filter((call) => call.path.endsWith("/auth/refresh")).length, 0);
    assert.equal(response.status, 401);
    assert.equal(((await response.json()) as { code: string }).code, "STEP_UP_REUSED");
  });
});
