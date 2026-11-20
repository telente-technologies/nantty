import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { createSandboxApp } from "../src/sandboxApp.js";

const controlToken = "sandbox-control-token-that-is-longer-than-thirty-two-characters";
const sandboxToken = "ntsb_test_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG";

function createDatabase(): { readonly database: Pool; readonly query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM sandbox_credentials c JOIN")) return { rows: [{ id: "credential-1", application_id: "sandbox-app-1" }], rowCount: 1 };
    if (sql.includes("SELECT organization_id FROM sandbox_applications WHERE id = $1")) return { rows: [{ organization_id: "org-test" }], rowCount: 1 };
    if (sql.includes("INSERT INTO sandbox_customers")) return { rows: [{ id: "customer-1", externalReference: "customer-a", displayName: "Test customer" }], rowCount: 1 };
    if (sql.includes("INSERT INTO sandbox_applications")) return { rows: [{ id: "sandbox-app-1", organizationId: "org-test", applicationId: "app-test", name: "Test app", status: "active" }], rowCount: 1 };
    if (sql.includes("UPDATE sandbox_organization_usage_periods SET messages_sent")) return { rows: [{ messages_sent: 1, quota_limit_messages: 1000 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  return { database: { query, connect: vi.fn(async () => client) } as unknown as Pool, query };
}

function createMessageTransitionDatabase(initialStatus: string, sender = "business") {
  let status = initialStatus;
  const events: Array<{ readonly eventType: string; readonly aggregateId: string }> = [];
  const query = vi.fn(async (sql: string, parameters?: readonly unknown[]) => {
    if (sql.includes("FROM sandbox_messages WHERE id = $1 FOR UPDATE")) {
      return { rows: [{ id: "123e4567-e89b-12d3-a456-426614174001", applicationId: "sandbox-app-1", conversationId: "123e4567-e89b-12d3-a456-426614174002", sender, status }], rowCount: 1 };
    }
    if (sql.includes("UPDATE sandbox_messages SET status = $2")) status = String(parameters?.[1]);
    if (sql.includes("INSERT INTO sandbox_events")) events.push({ eventType: String(parameters?.[2]), aggregateId: String(parameters?.[3]) });
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  return { database: { query, connect: vi.fn(async () => client) } as unknown as Pool, query, events, currentStatus: () => status };
}

describe("Sandbox API credential boundary", () => {
  it("rejects a production-format API key before looking up a sandbox credential", async () => {
    const { database, query } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: "Bearer ntsb_live_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG" }, payload: { externalReference: "customer-a", displayName: "Test customer" } });
    expect(response.statusCode).toBe(401);
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("FROM sandbox_credentials c JOIN"))).toBe(false);
    await app.close();
  });

  it("rejects a missing credential and keeps the control plane separately authenticated", async () => {
    const { database, query } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const apiResponse = await app.inject({ method: "POST", url: "/v1/customers", payload: { externalReference: "customer-a", displayName: "Test customer" } });
    const controlResponse = await app.inject({ method: "POST", url: "/v1/control/applications", headers: { authorization: "Bearer wrong-control-secret" }, payload: { organizationId: "org-test", applicationId: "app-test", name: "Test app" } });
    expect(apiResponse.statusCode).toBe(401);
    expect(controlResponse.statusCode).toBe(401);
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO sandbox_applications"))).toBe(false);
    await app.close();
  });

  it("scopes synthetic customer creation to the validated sandbox application", async () => {
    const { database, query } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${sandboxToken}` }, payload: { externalReference: "customer-a", displayName: "Test customer" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: "customer-1", externalReference: "customer-a" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sandbox_customers"), expect.arrayContaining(["sandbox-app-1", "customer-a", "Test customer"]));
    await app.close();
  });

  it("rejects malformed resource IDs before querying the synthetic data store", async () => {
    const { database, query } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "GET", url: "/v1/conversations/not-a-uuid/messages", headers: { authorization: `Bearer ${sandboxToken}` } });
    expect(response.statusCode).toBe(400);
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("FROM sandbox_conversations WHERE id"))).toBe(false);
    await app.close();
  });

  it("requires the service-only control credential to provision an application", async () => {
    const { database } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/control/applications", headers: { authorization: `Bearer ${controlToken}` }, payload: { organizationId: "org-test", applicationId: "app-test", name: "Test app" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: "sandbox-app-1", organizationId: "org-test", applicationId: "app-test" });
    await app.close();
  });

  it("validates control-plane application input before opening a transaction", async () => {
    const { database } = createDatabase();
    const connect = vi.mocked(database.connect);
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/control/applications", headers: { authorization: `Bearer ${controlToken}` }, payload: { organizationId: "../other-org", applicationId: "app-test", name: "Test app" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    expect(connect).not.toHaveBeenCalled();
    await app.close();
  });

  it("requires an idempotency key before reading a sandbox conversation", async () => {
    const { database, query } = createDatabase();
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/conversations/123e4567-e89b-12d3-a456-426614174000/messages", headers: { authorization: `Bearer ${sandboxToken}` }, payload: { text: "A test reply" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } });
    expect(query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("FROM sandbox_conversations"))).toBe(false);
    await app.close();
  });

  it("does not expose database errors through the public API response", async () => {
    const { database, query } = createDatabase();
    query.mockRejectedValueOnce(new Error("private database connection detail"));
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${sandboxToken}` }, payload: { externalReference: "customer-a", displayName: "Test customer" } });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("private database connection detail");
    expect(response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    await app.close();
  });
});

describe("Sandbox control-plane message transitions", () => {
  it("atomically advances sent -> delivered -> read and does not duplicate replay events", async () => {
    const state = createMessageTransitionDatabase("sent");
    const app = createSandboxApp({ database: state.database, controlToken });
    const url = "/v1/control/messages/123e4567-e89b-12d3-a456-426614174001/transition";
    const headers = { authorization: `Bearer ${controlToken}` };

    const delivered = await app.inject({ method: "POST", url, headers, payload: { status: "delivered" } });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json()).toMatchObject({ status: "delivered", conversationId: "123e4567-e89b-12d3-a456-426614174002" });
    expect(state.currentStatus()).toBe("delivered");
    expect(state.events.map((event) => event.eventType)).toEqual(["message.delivered"]);

    const replay = await app.inject({ method: "POST", url, headers, payload: { status: "delivered" } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ status: "delivered", eventId: null });
    expect(state.events).toHaveLength(1);

    const read = await app.inject({ method: "POST", url, headers, payload: { status: "read" } });
    expect(read.statusCode).toBe(200);
    expect(state.currentStatus()).toBe("read");
    expect(state.events.map((event) => event.eventType)).toEqual(["message.delivered", "message.read"]);
    expect(state.query.mock.calls.filter(([sql]) => typeof sql === "string" && sql === "COMMIT")).toHaveLength(3);
    await app.close();
  });

  it("rejects invalid transitions and unauthorized control calls without changing message state", async () => {
    const state = createMessageTransitionDatabase("sent");
    const app = createSandboxApp({ database: state.database, controlToken });
    const url = "/v1/control/messages/123e4567-e89b-12d3-a456-426614174001/transition";
    const unauthorized = await app.inject({ method: "POST", url, payload: { status: "delivered" } });
    const invalid = await app.inject({ method: "POST", url, headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "read" } });
    expect(unauthorized.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(409);
    expect(state.currentStatus()).toBe("sent");
    expect(state.events).toHaveLength(0);
    expect(state.query.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("UPDATE sandbox_messages"))).toBe(false);
    await app.close();
  });

  it("does not advance customer-originated messages through outbound delivery states", async () => {
    const state = createMessageTransitionDatabase("received", "customer");
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "POST", url: "/v1/control/messages/123e4567-e89b-12d3-a456-426614174001/transition", headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "read" } });
    expect(response.statusCode).toBe(409);
    expect(state.currentStatus()).toBe("received");
    expect(state.events).toHaveLength(0);
    await app.close();
  });

  it("enforces request rate limiting on sandbox API routes", async () => {
    const { database } = createDatabase();
    const app = createSandboxApp({ database, controlToken, rateLimitMax: 2, rateLimitWindowMs: 60_000 });
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(429);
    await app.close();
  });
});
