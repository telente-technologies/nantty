import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { readAdminConsoleOrigin } from "@/config/adminEnvironment.config";
import { sessionCookieNames } from "@/config/sessionCookies.config";
import { startMockAdminSession } from "@/mocks/mockAuthTokens.mock";
import { readMockMoneyStore } from "@/mocks/handlers/money/moneyStore.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { forwardBffRequestToAdminApi } from "@/server/bffGateway.service";
import { createNewSessionId, nowInEpochSeconds } from "@/server/adminSession.service";
import { deriveCsrfTokenForSession, signPayloadIntoCookieValue } from "@/server/signedCookie.service";
import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { SignedInAdmin } from "@/types/admin.type";

interface TestSession {
  readonly sessionId: string;
  readonly cookies: Record<string, string>;
  readonly mockSessionId: string;
}

function findDemoAdmin(adminId: string) {
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === adminId);
  assert.ok(admin, adminId);
  return admin;
}

function openSession(adminId: string, overridePermissions?: readonly AdminPermission[]): TestSession {
  const record = findDemoAdmin(adminId);
  const tokens = startMockAdminSession(record, "127.0.0.1", "test");
  const mockSessionId = readMockDatabase().accessTokens.get(tokens.accessToken)!.sessionId;
  const admin: SignedInAdmin = { id: record.id, email: record.email, name: record.name, role: record.role, permissions: overridePermissions ?? record.permissions };
  const sessionId = createNewSessionId();
  const now = nowInEpochSeconds();
  return {
    sessionId,
    mockSessionId,
    cookies: {
      [sessionCookieNames.session]: signPayloadIntoCookieValue({ sessionId, startedAtEpochSeconds: now }, "admin-session", 3600),
      [sessionCookieNames.sessionView]: signPayloadIntoCookieValue({ sessionId, admin, lastActivityAtEpochSeconds: now, verifiedAtEpochSeconds: now }, "admin-session-view", 900),
      [sessionCookieNames.accessToken]: tokens.accessToken,
      [sessionCookieNames.refreshToken]: tokens.refreshToken,
    },
  };
}

function grantStepUp(session: TestSession, options: { forSessionId?: string; lifetimeSeconds?: number } = {}): void {
  const record = readMockDatabase().admins.find((admin) => readMockDatabase().adminSessions.get(session.mockSessionId)?.adminId === admin.id)!;
  const token = `mock_stepup_${Math.random().toString(36).slice(2)}`;
  readMockDatabase().stepUpTokens.set(token, { adminId: record.id, sessionId: session.mockSessionId, expiresAtEpochMs: Date.now() + 300_000 });
  session.cookies[sessionCookieNames.stepUp] = signPayloadIntoCookieValue({ sessionId: options.forSessionId ?? session.sessionId, stepUpToken: token }, "admin-step-up", options.lifetimeSeconds ?? 300);
}

async function callBff(session: TestSession, method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ cookie: Object.entries(session.cookies).map(([name, value]) => `${name}=${value}`).join("; "), ...extraHeaders });
  if (method !== "GET") {
    headers.set("origin", readAdminConsoleOrigin());
    headers.set("sec-fetch-site", "same-origin");
    if (!("x-csrf-token" in extraHeaders)) headers.set("x-csrf-token", deriveCsrfTokenForSession(session.sessionId));
    headers.set("content-type", "application/json");
  }
  const request = new NextRequest(new URL(`/bff${path}`, readAdminConsoleOrigin()), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const response = await forwardBffRequestToAdminApi(request, path.split("/").filter(Boolean));
  const payload = (await response.json().catch(() => null)) as { code?: string } | null;
  return { status: response.status, code: payload?.code ?? null, headers: response.headers };
}

const supportAgentId = "adm_0003";
const superadminId = "adm_0001";

describe("BFF enforcement (forged calls)", () => {
  it("returns 403 when a staff member calls an endpoint outside their permissions", async () => {
    const session = openSession(supportAgentId, ["support:tickets"]);
    const result = await callBff(session, "GET", "/admin/withdrawals");
    assert.deepEqual([result.status, result.code], [403, "FORBIDDEN"]);
    const ban = await callBff(session, "POST", "/admin/users/usr_1/ban", { reason: "forged call attempt", durationDays: null });
    assert.deepEqual([ban.status, ban.code], [403, "FORBIDDEN"]);
    const logistics = await callBff(session, "GET", "/admin/logistics/shipments");
    assert.deepEqual([logistics.status, logistics.code], [403, "FORBIDDEN"]);
  });

  it("returns 404 for routes that are not in the table", async () => {
    const session = openSession(superadminId);
    assert.equal((await callBff(session, "GET", "/admin/flags")).status, 404);
    assert.equal((await callBff(session, "DELETE", "/admin/users/usr_1")).status, 404);
    assert.equal((await callBff(session, "GET", "/admin/auth/me")).status, 404);
  });

  it("lets a superadmin with no explicit permission claims load backend role templates", async () => {
    const session = openSession(superadminId, []);
    const result = await callBff(session, "GET", "/admin/roles");
    assert.equal(result.status, 200);
  });

  it("lets the seeded superadmin invite another superadmin through the backend flow", async () => {
    const session = openSession(superadminId, []);
    grantStepUp(session);
    const result = await callBff(session, "POST", "/admin/admins", {
      name: "Second Superadmin",
      email: "second.superadmin@example.com",
      role: "SUPERADMIN",
      roleIds: [],
      permissions: [],
      reason: "Adding a second authorized superadmin",
    });
    assert.equal(result.status, 201);
  });

  it("rejects a mutation without the CSRF token", async () => {
    const session = openSession(superadminId);
    const result = await callBff(session, "POST", "/admin/users/usr_1/warn", { reason: "Spam links in bio", policy: "spam", addStrike: false }, { "x-csrf-token": "forged" });
    assert.deepEqual([result.status, result.code], [403, "CSRF_REJECTED"]);
  });

  it("rejects a destructive action without a reason before step-up is even asked", async () => {
    const session = openSession(superadminId);
    const missing = await callBff(session, "POST", "/admin/users/usr_1/ban", { durationDays: null });
    assert.deepEqual([missing.status, missing.code], [400, "REASON_REQUIRED"]);
    const blank = await callBff(session, "POST", "/admin/withdrawals/wd_1/review", { decision: "approve", reason: "  ok " });
    assert.deepEqual([blank.status, blank.code], [400, "REASON_REQUIRED"]);
  });

  it("requires step-up for PII reveal, money and account actions", async () => {
    const session = openSession(superadminId);
    for (const [method, path, body] of [
      ["GET", "/admin/users/usr_1/personal-data?purpose=fraud", undefined],
      ["POST", "/admin/refunds", { orderId: "o1", amount: { amountMinor: 100, currency: "NGN" }, reason: "Item never arrived" }],
      ["POST", "/admin/payments/webhooks/dead-letters/wh_1/replay", { reason: "Provider fixed outage" }],
      ["POST", "/admin/users/usr_1/suspend", { reason: "Repeated harassment", durationDays: 7 }],
      ["POST", "/admin/chat-reports/cr_1/actions", { action: "BAN_USER", reason: "Child safety evidence" }],
    ] as const) {
      const result = await callBff(session, method, path.split("?")[0]!, body);
      assert.deepEqual([result.status, result.code], [403, "STEP_UP_REQUIRED"], `${method} ${path}`);
    }
  });

  it("refuses a step-up grant replayed from another session or after it expired", async () => {
    const session = openSession(superadminId);
    grantStepUp(session, { forSessionId: "another-session" });
    const replayed = await callBff(session, "POST", "/admin/users/usr_1/ban", { reason: "Replayed grant test", durationDays: null });
    assert.deepEqual([replayed.status, replayed.code], [403, "STEP_UP_REQUIRED"]);
    grantStepUp(session, { lifetimeSeconds: -5 });
    const expired = await callBff(session, "POST", "/admin/users/usr_1/ban", { reason: "Expired grant test", durationDays: null });
    assert.deepEqual([expired.status, expired.code], [403, "STEP_UP_REQUIRED"]);
  });

  it("uses a money step-up once: the cookie is cleared after use and a replay asks for a new code without signing out", async () => {
    const session = openSession(superadminId);
    grantStepUp(session);
    const withdrawalId = readMockMoneyStore().withdrawals[0]!.id;
    const first = await callBff(session, "POST", `/admin/withdrawals/${withdrawalId}/review`, { decision: "hold", reason: "Checking the account name" }, { "idempotency-key": "money-stepup-1" });
    assert.notEqual(first.code, "STEP_UP_REQUIRED");
    assert.match(first.headers.get("set-cookie") ?? "", new RegExp(`${sessionCookieNames.stepUp}=;`));
    const replayed = await callBff(session, "POST", `/admin/withdrawals/${withdrawalId}/review`, { decision: "hold", reason: "Checking the account name" }, { "idempotency-key": "money-stepup-2" });
    assert.deepEqual([replayed.status, replayed.code], [403, "STEP_UP_REQUIRED"]);
  });

  it("lets a stepped-up, permitted admin through to the backend", async () => {
    const session = openSession(superadminId);
    grantStepUp(session);
    const result = await callBff(session, "GET", "/admin/users/usr_0001/personal-data");
    assert.notEqual(result.code, "STEP_UP_REQUIRED");
    assert.notEqual(result.code, "FORBIDDEN");
  });

  it("signs the admin out when their permissions changed since the cached view", async () => {
    const session = openSession(supportAgentId, ["support:tickets", "users:read", "users:ban"]);
    const staleView = signPayloadIntoCookieValue({ sessionId: session.sessionId, admin: { ...findDemoAdmin(supportAgentId), permissions: ["support:tickets", "users:read", "users:ban"] }, lastActivityAtEpochSeconds: nowInEpochSeconds(), verifiedAtEpochSeconds: nowInEpochSeconds() - 3600 }, "admin-session-view", 900);
    session.cookies[sessionCookieNames.sessionView] = staleView;
    const result = await callBff(session, "GET", "/admin/users");
    assert.deepEqual([result.status, result.code], [401, "SESSION_PRIVILEGES_CHANGED"]);
  });
});
