import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { consumeMessageQuota, incrementScenarioUsage, readApplicationUsage, SandboxQuotaExceeded } from "./sandboxUsage.js";
import { enqueueWebhookDeliveries } from "./webhookOutbox.js";
import {
  actorAccountId,
  authorize,
  ensureActiveApplication,
  error,
  findApplication,
  lockApplication,
  objectBody,
  rollback,
  stringField,
  validRefs,
  writeAudit,
  type WebhookRouteParams,
} from "./webhookControlSupport.js";

const supportedScenarios = new Set(["inbound_reply_cycle", "delivery_receipt_chain", "failed_delivery_webhook"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validTransitions: Record<string, readonly string[]> = { sent: ["delivered", "failed"], delivered: ["read", "failed"], read: [], failed: [] };

interface InspectionOptions {
  readonly database: Pool;
  readonly controlToken: string;
}

interface ScopedMessageParams extends WebhookRouteParams {
  readonly messageId: string;
}

interface ScopedConversationParams extends WebhookRouteParams {
  readonly conversationId: string;
}

export function registerSandboxInspectionRoutes(app: FastifyInstance, options: InspectionOptions): void {
  const base = "/v1/control/organizations/:organizationId/applications/:applicationId";

  app.get<{ Params: WebhookRouteParams }>(`${base}/requests`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const appId = await findApplication(options.database, request.params);
    if (!appId) return { requests: [] };
    const result = await options.database.query(
      "SELECT request_id AS \"requestId\", method, path, status_code AS \"statusCode\", created_at AS \"createdAt\" FROM sandbox_api_requests WHERE application_id = $1 ORDER BY created_at DESC LIMIT 100",
      [appId],
    );
    return { requests: result.rows };
  });

  app.get<{ Params: WebhookRouteParams }>(`${base}/usage`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const appId = await findApplication(options.database, request.params);
    const usage = await readApplicationUsage(options.database, appId);
    return { usage };
  });

  app.get<{ Params: WebhookRouteParams }>(`${base}/conversations`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const appId = await findApplication(options.database, request.params);
    if (!appId) return { conversations: [], events: [] };
    const conversations = await options.database.query(
      "SELECT c.id, c.status, c.created_at AS \"createdAt\", c.updated_at AS \"updatedAt\", cu.id AS \"customerId\", cu.external_reference AS \"customerReference\", cu.display_name AS \"customerName\", (SELECT json_agg(json_build_object('id',m.id,'sender',m.sender,'text',m.text,'status',m.status,'createdAt',m.created_at) ORDER BY m.created_at) FROM (SELECT id, sender, text, status, created_at FROM sandbox_messages WHERE conversation_id=c.id AND application_id=c.application_id ORDER BY created_at DESC LIMIT 20) m) AS messages FROM sandbox_conversations c JOIN sandbox_customers cu ON cu.id=c.customer_id AND cu.application_id=c.application_id WHERE c.application_id=$1 ORDER BY c.updated_at DESC LIMIT 50",
      [appId],
    );
    const events = await options.database.query(
      "SELECT id, event_type AS \"eventType\", aggregate_id AS \"aggregateId\", data, created_at AS \"createdAt\" FROM sandbox_events WHERE application_id=$1 ORDER BY created_at DESC LIMIT 50",
      [appId],
    );
    return { conversations: conversations.rows, events: events.rows };
  });

  app.post<{ Params: WebhookRouteParams }>(`${base}/scenarios/run`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const body = objectBody(request.body);
    const scenario = stringField(body, "scenario", 64);
    const applicationName = stringField(body, "applicationName", 120) ?? "Sandbox application";
    if (!scenario || !supportedScenarios.has(scenario)) return reply.code(400).send(error("INVALID_SCENARIO", "Unsupported sandbox scenario"));

    const actor = actorAccountId(request)!;
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await ensureActiveApplication(client, request.params, applicationName);
      if (!appId) { await client.query("ROLLBACK"); return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found")); }
      await consumeMessageQuota(client, appId);
      const customerId = randomUUID();
      const conversationId = randomUUID();
      const inboundId = randomUUID();
      const outboundId = randomUUID();
      const inboundEventId = randomUUID();
      const statusEventId = randomUUID();
      const customerRef = `scenario-${scenario}-${customerId.slice(0, 8)}`;
      await client.query("INSERT INTO sandbox_customers (id, application_id, external_reference, display_name, created_at) VALUES ($1,$2,$3,$4,now())", [customerId, appId, customerRef, "Synthetic Test Customer"]);
      await client.query("INSERT INTO sandbox_conversations (id, application_id, customer_id, status, created_at, updated_at) VALUES ($1,$2,$3,'open',now(),now())", [conversationId, appId, customerId]);
      await client.query("INSERT INTO sandbox_messages (id, application_id, conversation_id, idempotency_key, sender, text, status, created_at) VALUES ($1,$2,$3,$4,'customer','Can you confirm my test order status?','received',now())", [inboundId, appId, conversationId, `scn-in-${inboundId}`]);
      await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1,$2,'message.received',$3,$4,now())", [inboundEventId, appId, conversationId, JSON.stringify({ messageId: inboundId, conversationId, scenario })]);
      await enqueueWebhookDeliveries(client, appId, inboundEventId, "message.received");

      const targetStatus = scenario === "failed_delivery_webhook" ? "failed" : scenario === "delivery_receipt_chain" ? "read" : "delivered";
      const statusEventType = targetStatus === "failed" ? "message.failed" : targetStatus === "read" ? "message.read" : "message.delivered";
      await client.query("INSERT INTO sandbox_messages (id, application_id, conversation_id, idempotency_key, sender, text, status, created_at) VALUES ($1,$2,$3,$4,'business','Your synthetic test order is confirmed.',$5,now())", [outboundId, appId, conversationId, `scn-out-${outboundId}`, targetStatus]);
      await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1,$2,$3,$4,$5,now())", [statusEventId, appId, statusEventType, conversationId, JSON.stringify({ messageId: outboundId, conversationId, scenario })]);
      await enqueueWebhookDeliveries(client, appId, statusEventId, statusEventType);
      await incrementScenarioUsage(client, appId);
      await writeAudit(client, request, actor, "scenario.executed", appId, { scenario, conversationId });
      await client.query("COMMIT");
      return reply.code(201).send({ scenario, customerId, conversationId, inboundMessageId: inboundId, outboundMessageId: outboundId, finalStatus: targetStatus, events: ["message.received", statusEventType] });
    } catch (cause) {
      await rollback(client);
      if (cause instanceof SandboxQuotaExceeded) return reply.code(429).send({ error: { code: "SANDBOX_QUOTA_EXCEEDED", message: cause.message, details: { remaining: 0, limit: cause.limit, resetAt: cause.resetAt } } });
      request.log.error({ cause, requestId: request.id }, "Sandbox scenario execution failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: WebhookRouteParams }>(`${base}/reset`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const actor = actorAccountId(request)!;
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) { await client.query("ROLLBACK"); return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found")); }
      const deletedCustomers = await client.query("DELETE FROM sandbox_customers WHERE application_id = $1", [appId]);
      const deletedEvents = await client.query("DELETE FROM sandbox_events WHERE application_id = $1", [appId]);
      await writeAudit(client, request, actor, "sandbox.reset", appId, { customersCleared: String(deletedCustomers.rowCount ?? 0), eventsCleared: String(deletedEvents.rowCount ?? 0) });
      await client.query("COMMIT");
      return reply.code(200).send({ reset: true, usagePreserved: true });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox reset failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: WebhookRouteParams }>(`${base}/conversations`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const body = objectBody(request.body);
    const customerName = stringField(body, "customerName", 120) ?? "Synthetic Test Customer";
    const applicationName = stringField(body, "applicationName", 120) ?? "Sandbox application";
    const actor = actorAccountId(request)!;
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await ensureActiveApplication(client, request.params, applicationName);
      if (!appId) { await client.query("ROLLBACK"); return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found")); }
      const customerId = randomUUID();
      const conversationId = randomUUID();
      await client.query("INSERT INTO sandbox_customers (id, application_id, external_reference, display_name, created_at) VALUES ($1,$2,$3,$4,now())", [customerId, appId, `cust-${customerId.slice(0, 8)}`, customerName]);
      await client.query("INSERT INTO sandbox_conversations (id, application_id, customer_id, status, created_at, updated_at) VALUES ($1,$2,$3,'open',now(),now())", [conversationId, appId, customerId]);
      await writeAudit(client, request, actor, "conversation.created", appId, { conversationId });
      await client.query("COMMIT");
      return reply.code(201).send({ id: conversationId, customerId, customerName, status: "open" });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox conversation creation failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: ScopedConversationParams }>(`${base}/conversations/:conversationId/messages`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.conversationId)) return reply.code(400).send(error("INVALID_REQUEST", "Valid application and conversation IDs are required"));
    const body = objectBody(request.body);
    const sender = stringField(body, "sender", 16) === "business" ? "business" : "customer";
    const text = stringField(body, "text", 2000);
    if (!text) return reply.code(400).send(error("INVALID_REQUEST", "Message text is required"));
    const actor = actorAccountId(request)!;
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) { await client.query("ROLLBACK"); return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found")); }
      const conv = await client.query("SELECT id FROM sandbox_conversations WHERE id=$1 AND application_id=$2", [request.params.conversationId, appId]);
      if (!conv.rows[0]) { await client.query("ROLLBACK"); return reply.code(404).send(error("CONVERSATION_NOT_FOUND", "Sandbox conversation not found")); }
      if (sender === "business") await consumeMessageQuota(client, appId);
      const messageId = randomUUID();
      const eventId = randomUUID();
      const status = sender === "business" ? "sent" : "received";
      const eventType = sender === "business" ? "message.sent" : "message.received";
      await client.query("INSERT INTO sandbox_messages (id, application_id, conversation_id, idempotency_key, sender, text, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())", [messageId, appId, request.params.conversationId, `ctrl-${messageId}`, sender, text, status]);
      await client.query("UPDATE sandbox_conversations SET updated_at=now() WHERE id=$1 AND application_id=$2", [request.params.conversationId, appId]);
      await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1,$2,$3,$4,$5,now())", [eventId, appId, eventType, request.params.conversationId, JSON.stringify({ messageId, conversationId: request.params.conversationId })]);
      await enqueueWebhookDeliveries(client, appId, eventId, eventType);
      await writeAudit(client, request, actor, `message.${sender}_simulated`, appId, { messageId, conversationId: request.params.conversationId });
      await client.query("COMMIT");
      return reply.code(201).send({ id: messageId, conversationId: request.params.conversationId, sender, text, status, eventId });
    } catch (cause) {
      await rollback(client);
      if (cause instanceof SandboxQuotaExceeded) return reply.code(429).send({ error: { code: "SANDBOX_QUOTA_EXCEEDED", message: cause.message, details: { remaining: 0, limit: cause.limit, resetAt: cause.resetAt } } });
      request.log.error({ cause, requestId: request.id }, "Sandbox message simulation failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: ScopedMessageParams }>(`${base}/messages/:messageId/transition`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.messageId)) return reply.code(400).send(error("INVALID_REQUEST", "Valid application and message IDs are required"));
    const body = objectBody(request.body);
    const status = stringField(body, "status", 24);
    if (!status || !["delivered", "read", "failed"].includes(status)) return reply.code(400).send(error("INVALID_STATUS", "Status must be delivered, read, or failed"));
    const actor = actorAccountId(request)!;
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) { await client.query("ROLLBACK"); return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found")); }
      const existing = await client.query<{ readonly id: string; readonly conversationId: string; readonly sender: string; readonly status: string }>("SELECT id, conversation_id AS \"conversationId\", sender, status FROM sandbox_messages WHERE id=$1 AND application_id=$2 FOR UPDATE", [request.params.messageId, appId]);
      const msg = existing.rows[0];
      if (!msg) { await client.query("ROLLBACK"); return reply.code(404).send(error("MESSAGE_NOT_FOUND", "Sandbox message not found")); }
      if (msg.sender !== "business") { await client.query("ROLLBACK"); return reply.code(409).send(error("INVALID_STATE_TRANSITION", "Only business messages transition through delivery states")); }
      if (msg.status === status) { await client.query("COMMIT"); return { id: msg.id, conversationId: msg.conversationId, status, eventId: null }; }
      if (!(validTransitions[msg.status] ?? []).includes(status)) { await client.query("ROLLBACK"); return reply.code(409).send(error("INVALID_STATE_TRANSITION", "Message status cannot move to the requested state")); }
      const eventId = randomUUID();
      const eventType = `message.${status}`;
      await client.query("UPDATE sandbox_messages SET status=$2 WHERE id=$1 AND application_id=$3", [msg.id, status, appId]);
      await client.query("INSERT INTO sandbox_events (id, application_id, event_type, aggregate_id, data, created_at) VALUES ($1,$2,$3,$4,$5,now())", [eventId, appId, eventType, msg.conversationId, JSON.stringify({ messageId: msg.id, conversationId: msg.conversationId })]);
      await enqueueWebhookDeliveries(client, appId, eventId, eventType);
      await writeAudit(client, request, actor, "message.transitioned", appId, { messageId: msg.id, status });
      await client.query("COMMIT");
      return { id: msg.id, conversationId: msg.conversationId, status, eventId };
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox message transition failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });
}
