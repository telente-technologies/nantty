import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

import { resolveSandboxMessageTransition, type SandboxMessageTargetStatus } from "./messageState.js";
import { consumeMessageQuota, SandboxQuotaExceeded } from "./sandboxUsage.js";
import { error, objectBody, rollback, stringField } from "./webhookControlSupport.js";
import { enqueueWebhookDeliveries } from "./webhookOutbox.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumTextLength = 4_000;

export interface SandboxPrincipal {
  readonly credentialId: string;
  readonly appId: string;
}

export function registerSandboxMessagingRoutes(app: FastifyInstance, database: Pool, controlToken: string, principals: WeakMap<FastifyRequest, SandboxPrincipal>): void {
  app.post("/v1/customers", async (request, reply) => {
    const body = objectBody(request.body);
    const externalReference = stringField(body, "externalReference", 128);
    const displayName = stringField(body, "displayName", 120);
    if (!externalReference || !displayName) return reply.code(400).send(error("INVALID_REQUEST", "externalReference and displayName are required"));
    const principal = principals.get(request)!;
    const result = await database.query(
      "INSERT INTO sandbox_customers (id, application_id, external_reference, display_name, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (application_id, external_reference) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id, external_reference AS \"externalReference\", display_name AS \"displayName\", created_at AS \"createdAt\"",
      [randomUUID(), principal.appId, externalReference, displayName],
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post<{ Params: { customerId: string } }>("/v1/customers/:customerId/conversations", async (request, reply) => {
    if (!uuidPattern.test(request.params.customerId)) return reply.code(400).send(error("INVALID_CUSTOMER", "Customer identifier is invalid"));
    const principal = principals.get(request)!;
    const customer = await database.query("SELECT id FROM sandbox_customers WHERE id = $1 AND application_id = $2", [request.params.customerId, principal.appId]);
    if (!customer.rowCount) return reply.code(404).send(error("CUSTOMER_NOT_FOUND", "Sandbox customer not found"));
    const result = await database.query(
      "INSERT INTO sandbox_conversations (id, application_id, customer_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'open', now(), now()) RETURNING id, customer_id AS \"customerId\", status, created_at AS \"createdAt\"",
      [randomUUID(), principal.appId, request.params.customerId],
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post<{ Params: { conversationId: string } }>("/v1/conversations/:conversationId/messages", async (request, reply) => {
    if (!uuidPattern.test(request.params.conversationId)) return reply.code(400).send(error("INVALID_CONVERSATION", "Conversation identifier is invalid"));
    const principal = principals.get(request)!;
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || !identifierPattern.test(idempotencyKey)) return reply.code(400).send(error("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required"));
    const body = objectBody(request.body);
    const text = stringField(body, "text", maximumTextLength);
    if (!text) return reply.code(400).send(error("INVALID_REQUEST", "text must contain 1 to 4000 characters"));
    const principalConversation = await database.query("SELECT id FROM sandbox_conversations WHERE id = $1 AND application_id = $2", [request.params.conversationId, principal.appId]);
    if (!principalConversation.rowCount) return reply.code(404).send(error("CONVERSATION_NOT_FOUND", "Sandbox conversation not found"));
    try {
      const message = await persistMessage(database, { appId: principal.appId, conversationId: request.params.conversationId, idempotencyKey, sender: "business", text, status: "sent" });
      return reply.code(message.created ? 201 : 200).send(message.record);
    } catch (cause) {
      if (cause instanceof IdempotencyConflict) return reply.code(409).send(error("IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for a different message"));
      if (cause instanceof SandboxQuotaExceeded) return reply.code(429).send({ error: { code: "SANDBOX_QUOTA_EXCEEDED", message: cause.message, details: { remaining: 0, limit: cause.limit, resetAt: cause.resetAt } } });
      throw cause;
    }
  });

  app.get<{ Params: { conversationId: string } }>("/v1/conversations/:conversationId/messages", async (request, reply) => {
    if (!uuidPattern.test(request.params.conversationId)) return reply.code(400).send(error("INVALID_CONVERSATION", "Conversation identifier is invalid"));
    const principal = principals.get(request)!;
    const result = await database.query(
      "SELECT m.id, m.sender, m.text, m.status, m.created_at AS \"createdAt\" FROM sandbox_messages m JOIN sandbox_conversations c ON c.id = m.conversation_id AND c.application_id = m.application_id WHERE m.conversation_id = $1 AND m.application_id = $2 ORDER BY m.created_at DESC LIMIT 100",
      [request.params.conversationId, principal.appId],
    );
    if (result.rows.length === 0) {
      const conversation = await database.query("SELECT id FROM sandbox_conversations WHERE id = $1 AND application_id = $2", [request.params.conversationId, principal.appId]);
      if (!conversation.rowCount) return reply.code(404).send(error("CONVERSATION_NOT_FOUND", "Sandbox conversation not found"));
    }
    return { messages: result.rows.reverse() };
  });

  app.post<{ Params: { conversationId: string } }>("/v1/control/conversations/:conversationId/inbound", async (request, reply) => {
    if (!isControlTokenValid(request, controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    if (!uuidPattern.test(request.params.conversationId)) return reply.code(400).send(error("INVALID_CONVERSATION", "Conversation identifier is invalid"));
    const idempotencyKey = request.headers["idempotency-key"];
    const body = objectBody(request.body);
    const text = stringField(body, "text", maximumTextLength);
    if (typeof idempotencyKey !== "string" || !identifierPattern.test(idempotencyKey) || !text) return reply.code(400).send(error("INVALID_REQUEST", "Idempotency-Key and text are required"));
    const conversation = await database.query<{ readonly application_id: string }>("SELECT application_id FROM sandbox_conversations WHERE id = $1", [request.params.conversationId]);
    if (!conversation.rows[0]) return reply.code(404).send(error("CONVERSATION_NOT_FOUND", "Sandbox conversation not found"));
    try {
      const message = await persistMessage(database, { appId: conversation.rows[0].application_id, conversationId: request.params.conversationId, idempotencyKey, sender: "customer", text, status: "received", eventType: "message.received" });
      return reply.code(message.created ? 201 : 200).send(message.record);
    } catch (cause) {
      if (cause instanceof IdempotencyConflict) return reply.code(409).send(error("IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for a different message"));
      throw cause;
    }
  });

  app.post<{ Params: { messageId: string } }>("/v1/control/messages/:messageId/transition", async (request, reply) => {
    if (!isControlTokenValid(request, controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    if (!uuidPattern.test(request.params.messageId)) return reply.code(400).send(error("INVALID_MESSAGE", "Message identifier is invalid"));
    const targetStatus = stringField(objectBody(request.body), "status", 16);
    if (targetStatus !== "delivered" && targetStatus !== "read" && targetStatus !== "failed") return reply.code(400).send(error("INVALID_TRANSITION", "status must be delivered, read, or failed"));

    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ readonly id: string; readonly applicationId: string; readonly conversationId: string; readonly sender: string; readonly status: string }>(
        "SELECT id, application_id AS \"applicationId\", conversation_id AS \"conversationId\", sender, status FROM sandbox_messages WHERE id = $1 FOR UPDATE",
        [request.params.messageId],
      );
      const message = result.rows[0];
      if (!message) { await client.query("ROLLBACK"); return reply.code(404).send(error("MESSAGE_NOT_FOUND", "Sandbox message not found")); }
      const transition = resolveSandboxMessageTransition(message.sender, message.status, targetStatus as SandboxMessageTargetStatus);
      if (!transition) { await client.query("ROLLBACK"); return reply.code(409).send(error("INVALID_TRANSITION", "Sandbox message cannot move to the requested state")); }
      let eventId: string | null = null;
      if (transition.eventType) {
        eventId = randomUUID();
        await client.query("UPDATE sandbox_messages SET status = $2 WHERE id = $1", [message.id, transition.status]);
        await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1, $2, $3, $4, $5, now())", [eventId, message.applicationId, transition.eventType, message.conversationId, JSON.stringify({ messageId: message.id, conversationId: message.conversationId })]);
        await enqueueWebhookDeliveries(client, message.applicationId, eventId, transition.eventType);
        await writeControlAudit(client, request, transition.eventType, message.applicationId, { messageId: message.id, conversationId: message.conversationId });
      }
      await client.query("COMMIT");
      return reply.code(200).send({ messageId: message.id, conversationId: message.conversationId, status: transition.status, eventId });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause }, "Sandbox message transition failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.get("/v1/events", async (request) => {
    const principal = principals.get(request)!;
    const result = await database.query(
      "SELECT id, event_type AS \"eventType\", aggregate_id AS \"aggregateId\", data, created_at AS \"createdAt\" FROM sandbox_events WHERE application_id = $1 ORDER BY created_at DESC LIMIT 100",
      [principal.appId],
    );
    return { events: result.rows };
  });
}

async function persistMessage(database: Pool, input: { appId: string; conversationId: string; idempotencyKey: string; sender: "business" | "customer"; text: string; status: "sent" | "received"; eventType?: string }): Promise<{ readonly record: Record<string, unknown>; readonly created: boolean }> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO sandbox_messages (id, application_id, conversation_id, idempotency_key, sender, text, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) ON CONFLICT (application_id, idempotency_key) DO NOTHING RETURNING id, conversation_id AS \"conversationId\", sender, text, status, created_at AS \"createdAt\"",
      [randomUUID(), input.appId, input.conversationId, input.idempotencyKey, input.sender, input.text, input.status],
    );
    if (!result.rows[0]) {
      const existing = await client.query(
        "SELECT id, conversation_id AS \"conversationId\", sender, text, status, created_at AS \"createdAt\" FROM sandbox_messages WHERE application_id = $1 AND idempotency_key = $2",
        [input.appId, input.idempotencyKey],
      );
      const record = existing.rows[0];
      if (!record || record.conversationId !== input.conversationId || record.sender !== input.sender || record.text !== input.text) throw new IdempotencyConflict();
      await client.query("COMMIT");
      return { record, created: false };
    }
    if (input.sender === "business") await consumeMessageQuota(client, input.appId);
    await client.query("UPDATE sandbox_conversations SET updated_at = now() WHERE id = $1 AND application_id = $2", [input.conversationId, input.appId]);
    if (input.eventType) {
      const eventId = randomUUID();
      await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1, $2, $3, $4, $5, now())", [eventId, input.appId, input.eventType, input.conversationId, JSON.stringify({ messageId: result.rows[0].id, conversationId: input.conversationId })]);
      await enqueueWebhookDeliveries(client, input.appId, eventId, input.eventType);
    }
    await client.query("COMMIT");
    return { record: result.rows[0], created: true };
  } catch (cause) {
    await rollback(client);
    throw cause;
  } finally {
    client.release();
  }
}

class IdempotencyConflict extends Error {}

async function writeControlAudit(client: PoolClient, request: FastifyRequest, action: string, applicationId: string, metadata: Record<string, string>): Promise<void> {
  await client.query("INSERT INTO sandbox_control_audit (id, actor, action, application_id, metadata, created_at) VALUES ($1, 'sandbox-control', $2, $3, $4, now())", [randomUUID(), action, applicationId, JSON.stringify({ ...metadata, requestId: request.id })]);
}

function isControlTokenValid(request: FastifyRequest, expected: string): boolean {
  const token = request.headers.authorization?.match(/^Bearer ([^\s]{1,512})$/)?.[1];
  if (!token) return false;
  const candidate = Buffer.from(token);
  const configured = Buffer.from(expected);
  return candidate.length === configured.length && timingSafeEqual(candidate, configured);
}
