import type { HttpRequestContext } from "@nantty/fastify-platform";
import { beforeEach, describe, expect, it } from "vitest";

import { createRequestHandler, createRoutes } from "../src/app.js";
import type { Container } from "../src/container.js";
import { requireAnyPermission, requireStepUp, type StaffPrincipal } from "../src/middlewares/staffAuth.middleware.js";
import { ListNotificationsHandler } from "../src/modules/inbox/queries/listNotifications/listNotifications.handler.js";
import { GetUnreadCountHandler } from "../src/modules/inbox/queries/getUnreadCount/getUnreadCount.handler.js";
import { MarkNotificationReadHandler } from "../src/modules/inbox/commands/markNotificationRead/markNotificationRead.handler.js";
import { UnsubscribeFromMarketingHandler } from "../src/modules/unsubscribe/commands/unsubscribeFromMarketing/unsubscribeFromMarketing.handler.js";
import { createTestHarness, silentLogger, type TestHarness } from "./fakes/testHarness.fake.js";

let harness: TestHarness;
let handle: ReturnType<typeof createRequestHandler>;
const activityCalls: { accountId: string; timeZone: string }[] = [];

function request(method: string, url: string, headers: Record<string, string> = {}, body?: unknown): HttpRequestContext {
  const path = url.split("?")[0]!;
  return { method, path, url, body, id: "req-1", headers, getHeader: (name: string) => headers[name.toLowerCase()] } as unknown as HttpRequestContext;
}

async function call(method: string, url: string, headers: Record<string, string> = {}, body?: unknown) {
  const response = await handle(request(method, url, headers, body));
  const raw = response.body as unknown;
  return { status: response.status, body: typeof raw === "string" && raw !== "" ? (JSON.parse(raw) as Record<string, unknown>) : raw };
}

beforeEach(async () => {
  harness = createTestHarness();
  activityCalls.length = 0;
  const container = {
    listNotifications: new ListNotificationsHandler(harness.notifications),
    getUnreadCount: new GetUnreadCountHandler(harness.notifications),
    markNotificationRead: new MarkNotificationReadHandler(harness.notifications),
    unsubscribeTokens: harness.unsubscribeTokens,
    unsubscribeFromMarketing: new UnsubscribeFromMarketingHandler(harness.unsubscribeTokens, harness.identity, harness.unsubscribeReceipts),
    recordActivity: { execute: async (input: { accountId: string; timeZone: string }) => { activityCalls.push(input); } },
  } as unknown as Container;
  handle = createRequestHandler(createRoutes(container), silentLogger);
  await harness.notifications.insertIfAbsent({ userId: "u1", dedupeKey: "k1", category: "orders", kind: null, templateKey: null, title: "Order shipped", body: "b", actor: null, data: {} });
});

describe("inbox routes", () => {
  it("rejects requests without a gateway principal", async () => {
    expect((await call("GET", "/api/v1/notifications")).status).toBe(401);
  });

  it("lists in the page envelope and rejects an unknown filter", async () => {
    const ok = await call("GET", "/api/v1/notifications?filter=all", { "x-nantty-account-id": "u1" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ nextCursor: null, data: [{ title: "Order shipped", read: false }] });
    expect((await call("GET", "/api/v1/notifications?filter=bogus", { "x-nantty-account-id": "u1" })).status).toBe(400);
  });

  it("serves the unread count and marks read with 204, 404 for a stranger", async () => {
    const headers = { "x-nantty-account-id": "u1" };
    expect((await call("GET", "/api/v1/notifications/unread-count", headers)).body).toEqual({ count: 1 });
    const id = harness.notifications.rows[0]!.id;
    expect((await call("POST", `/api/v1/notifications/${id}/read`, headers)).status).toBe(204);
    expect((await call("POST", `/api/v1/notifications/${id}/read`, { "x-nantty-account-id": "u2" })).status).toBe(404);
  });

  it("returns 404 for unknown routes", async () => {
    expect((await call("GET", "/api/v1/nope")).status).toBe(404);
  });

  it("requires the authenticated account and a valid IANA timezone for activity heartbeats", async () => {
    expect((await call("POST", "/api/v1/notifications/activity", {}, { timeZone: "Africa/Lagos" })).status).toBe(401);
    expect((await call("POST", "/api/v1/notifications/activity", { "x-nantty-account-id": "u1" }, { timeZone: "Mars/Olympus" })).status).toBe(400);
    expect((await call("POST", "/api/v1/notifications/activity", { "x-nantty-account-id": "u1" }, { timeZone: "Africa/Lagos" })).status).toBe(204);
    expect(activityCalls).toEqual([{ accountId: "u1", timeZone: "Africa/Lagos" }]);
  });
});

describe("public unsubscribe route", () => {
  it("only confirms on GET and unsubscribes on POST", async () => {
    const token = harness.unsubscribeTokens.sign("u1");
    expect((await call("GET", `/api/v1/email/unsubscribe?token=${token}`)).status).toBe(200);
    expect(harness.identity.withdrawn).toEqual([]);
    expect((await call("POST", `/api/v1/email/unsubscribe?token=${token}`, {}, "List-Unsubscribe=One-Click")).status).toBe(200);
    expect(harness.identity.withdrawn).toEqual(["u1"]);
    const bodyToken = harness.unsubscribeTokens.sign("u2");
    expect((await call("POST", "/api/v1/email/unsubscribe", {}, { token: bodyToken })).status).toBe(200);
    expect(harness.identity.withdrawn).toEqual(["u1", "u2"]);
    expect((await call("POST", "/api/v1/email/unsubscribe?token=bad")).status).toBe(400);
  });
});

describe("staff guards", () => {
  const staff = (overrides: Partial<StaffPrincipal> = {}): StaffPrincipal => ({ id: "s1", name: "Staff", role: "admin", permissions: ["support:email"], steppedUp: false, ...overrides });

  it("allows holders of any listed permission and superadmins, denies the rest", () => {
    expect(() => requireAnyPermission(staff(), ["support:email", "marketing:email"])).not.toThrow();
    expect(() => requireAnyPermission(staff({ role: "superadmin", permissions: [] }), ["marketing:email"])).not.toThrow();
    expect(() => requireAnyPermission(staff(), ["marketing:email"])).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it("requires a step-up token for sensitive sends", () => {
    expect(() => requireStepUp(staff())).toThrowError(expect.objectContaining({ code: "STEP_UP_REQUIRED" }));
    expect(() => requireStepUp(staff({ steppedUp: true }))).not.toThrow();
  });
});
