import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { createSandboxApp } from "../src/sandboxApp.js";

const controlToken = "sandbox-control-token-that-is-longer-than-thirty-two-characters";
const sandboxToken = "ntsb_test_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG";
const base = "/v1/control/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/applications/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
const headers = { authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": "3fbcd9fc-dab8-4e3e-a832-209ae7ffbb5d" };

describe("Sandbox inspection, quotas, scenarios, and reset", () => {
  it("enforces atomic quota limits on outbound sandbox messages and rolls back on exhaustion", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT organization_id FROM sandbox_applications WHERE id = $1")) return { rows: [{ organization_id: "org-test" }], rowCount: 1 };
      if (sql.includes("FROM sandbox_credentials c JOIN")) return { rows: [{ id: "cred-1", application_id: "app-1" }], rowCount: 1 };
      if (sql.includes("FROM sandbox_conversations WHERE id = $1")) return { rows: [{ id: "conv-1" }], rowCount: 1 };
      if (sql.includes("INSERT INTO sandbox_messages")) return { rows: [{ id: "msg-1", conversationId: "123e4567-e89b-12d3-a456-426614174000", sender: "business", text: "Hi", status: "sent" }], rowCount: 1 };
      if (sql.includes("UPDATE sandbox_organization_usage_periods SET messages_sent")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT quota_limit_messages FROM sandbox_organization_usage_periods")) return { rows: [{ quota_limit_messages: 1000 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({
      method: "POST",
      url: "/v1/conversations/123e4567-e89b-12d3-a456-426614174000/messages",
      headers: { authorization: `Bearer ${sandboxToken}`, "idempotency-key": "msg-quota-1" },
      payload: { text: "Over quota" },
    });
    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ error: { code: "SANDBOX_QUOTA_EXCEEDED", details: { remaining: 0, limit: 1000 } } });
    expect(query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(true);
    await app.close();
  });

  it("does not consume quota on idempotent message replay", async () => {
    const existing = { id: "msg-1", conversationId: "123e4567-e89b-12d3-a456-426614174000", sender: "business", text: "Hello", status: "sent" };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM sandbox_credentials c JOIN")) return { rows: [{ id: "cred-1", application_id: "app-1" }], rowCount: 1 };
      if (sql.includes("FROM sandbox_conversations WHERE id = $1")) return { rows: [{ id: "conv-1" }], rowCount: 1 };
      if (sql.includes("INSERT INTO sandbox_messages")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT id, conversation_id AS")) return { rows: [existing], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({
      method: "POST",
      url: "/v1/conversations/123e4567-e89b-12d3-a456-426614174000/messages",
      headers: { authorization: `Bearer ${sandboxToken}`, "idempotency-key": "msg-replay-1" },
      payload: { text: "Hello" },
    });
    expect(response.statusCode).toBe(200);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE sandbox_organization_usage_periods SET messages_sent"))).toBe(false);
    await app.close();
  });

  it("runs deterministic scenarios and rejects unsupported scenarios", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id FROM sandbox_applications WHERE organization_id=$1")) return { rows: [{ id: "app-1" }], rowCount: 1 };
      if (sql.includes("SELECT organization_id FROM sandbox_applications WHERE id = $1")) return { rows: [{ organization_id: "org-test" }], rowCount: 1 };
      if (sql.includes("UPDATE sandbox_organization_usage_periods SET messages_sent")) return { rows: [{ messages_sent: 1, quota_limit_messages: 1000 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });

    const bad = await app.inject({ method: "POST", url: `${base}/scenarios/run`, headers, payload: { scenario: "unknown_flow" } });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({ method: "POST", url: `${base}/scenarios/run`, headers, payload: { scenario: "delivery_receipt_chain", applicationName: "Test App" } });
    expect(good.statusCode).toBe(201);
    expect(good.json()).toMatchObject({ scenario: "delivery_receipt_chain", finalStatus: "read", events: ["message.received", "message.read"] });
    await app.close();
  });

  it("resets synthetic customers and events without deleting billing-period usage or request logs", async () => {
    const executedSql: string[] = [];
    const query = vi.fn(async (sql: string) => {
      executedSql.push(sql);
      if (sql.includes("SELECT id FROM sandbox_applications WHERE organization_id=$1")) return { rows: [{ id: "app-1" }], rowCount: 1 };
      return { rows: [], rowCount: 2 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });
    const response = await app.inject({ method: "POST", url: `${base}/reset`, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reset: true, usagePreserved: true });
    expect(executedSql.some((sql) => sql.includes("DELETE FROM sandbox_organization_usage_periods"))).toBe(false);
    expect(executedSql.some((sql) => sql.includes("DELETE FROM sandbox_api_requests"))).toBe(false);
    await app.close();
  });

  it("returns redacted request logs and usage metrics", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id FROM sandbox_applications")) return { rows: [{ id: "app-1" }], rowCount: 1 };
      if (sql.includes("FROM sandbox_api_requests")) return { rows: [{ requestId: "req-1", method: "POST", path: "/v1/customers", statusCode: 201, createdAt: "2026-11-16T12:00:00.000Z" }], rowCount: 1 };
      if (sql.includes("FROM sandbox_organization_usage_periods")) return { rows: [{ messages_sent: 12, requests_count: 34, scenarios_run: 3, quota_limit_messages: 1000 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });
    const reqs = await app.inject({ method: "GET", url: `${base}/requests`, headers });
    const usage = await app.inject({ method: "GET", url: `${base}/usage`, headers });
    expect(reqs.statusCode).toBe(200);
    expect(reqs.json().requests).toHaveLength(1);
    expect(usage.statusCode).toBe(200);
    expect(usage.json().usage).toMatchObject({ messagesSent: 12, remainingMessages: 988, scenariosRun: 3, requestsCount: 34 });
    await app.close();
  });

  it("creates scoped conversations, simulates customer/business messages, and transitions scoped message states", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id FROM sandbox_applications")) return { rows: [{ id: "app-1" }], rowCount: 1 };
      if (sql.includes("SELECT id FROM sandbox_conversations WHERE id=$1")) return { rows: [{ id: "123e4567-e89b-12d3-a456-426614174010" }], rowCount: 1 };
      if (sql.includes("SELECT id, conversation_id AS")) return { rows: [{ id: "123e4567-e89b-12d3-a456-426614174011", conversationId: "123e4567-e89b-12d3-a456-426614174010", sender: "business", status: "sent" }], rowCount: 1 };
      if (sql.includes("UPDATE sandbox_organization_usage_periods SET messages_sent")) return { rows: [{ messages_sent: 1, quota_limit_messages: 1000 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const database = { query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as Pool;
    const app = createSandboxApp({ database, controlToken });

    const created = await app.inject({ method: "POST", url: `${base}/conversations`, headers, payload: { customerName: "Alice Sandbox" } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ customerName: "Alice Sandbox", status: "open" });

    const inbound = await app.inject({ method: "POST", url: `${base}/conversations/123e4567-e89b-12d3-a456-426614174010/messages`, headers, payload: { sender: "customer", text: "Hello from sandbox customer" } });
    expect(inbound.statusCode).toBe(201);
    expect(inbound.json()).toMatchObject({ sender: "customer", status: "received" });

    const transition = await app.inject({ method: "POST", url: `${base}/messages/123e4567-e89b-12d3-a456-426614174011/transition`, headers, payload: { status: "delivered" } });
    expect(transition.statusCode).toBe(200);
    expect(transition.json()).toMatchObject({ status: "delivered" });
    await app.close();
  });
});
