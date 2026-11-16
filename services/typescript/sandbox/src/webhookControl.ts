import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { resolvePublicWebhookTarget, WebhookTargetError } from "./webhookSecurity.js";
import {
  actorAccountId,
  authorize,
  encryptWebhookSecret,
  ensureActiveApplication,
  error,
  findApplication,
  lockApplication,
  objectBody,
  optionalDescription,
  parseEvents,
  parsePatch,
  publicWebhook,
  rollback,
  stringField,
  validRefs,
  writeAudit,
  uuidPattern,
  type WebhookRouteParams,
  type WebhookRow,
} from "./webhookControlSupport.js";

interface WebhookControlOptions {
  readonly database: Pool;
  readonly controlToken: string;
  readonly secretEncryptionKey: Buffer | null;
  readonly resolveTarget?: typeof resolvePublicWebhookTarget;
}

export function registerSandboxWebhookControlRoutes(app: FastifyInstance, options: WebhookControlOptions): void {
  const collectionPath = "/v1/control/organizations/:organizationId/applications/:applicationId/webhooks";

  app.get<{ Params: WebhookRouteParams }>(collectionPath, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    try {
      const appId = await findApplication(options.database, request.params);
      if (!appId) return { webhooks: [] };
      const result = await options.database.query<WebhookRow>(
        "SELECT id, url, description, events, active, created_at, updated_at FROM sandbox_webhook_endpoints WHERE application_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 100",
        [appId],
      );
      return { webhooks: result.rows.map(publicWebhook) };
    } catch (cause) {
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook listing failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    }
  });

  app.get<{ Params: WebhookRouteParams }>(`${collectionPath}/deliveries`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    try {
      const appId = await findApplication(options.database, request.params);
      if (!appId) return { deliveries: [] };
      const result = await options.database.query(
        "SELECT d.id, d.endpoint_id AS \"webhookId\", d.event_id AS \"eventId\", v.event_type AS event, d.status, d.attempts, d.last_http_status AS \"lastHttpStatus\", d.last_error_code AS \"lastErrorCode\", d.created_at AS \"createdAt\", d.updated_at AS \"updatedAt\", d.delivered_at AS \"deliveredAt\", (SELECT json_agg(json_build_object('attempt',a.attempt_number,'outcome',a.outcome,'httpStatus',a.http_status,'errorCode',a.error_code,'durationMs',a.duration_ms,'startedAt',a.started_at,'finishedAt',a.finished_at) ORDER BY a.attempt_number) FROM sandbox_webhook_delivery_attempts a WHERE a.delivery_id=d.id) AS attempts_history FROM sandbox_webhook_deliveries d JOIN sandbox_webhook_endpoints e ON e.id=d.endpoint_id JOIN sandbox_events v ON v.id=d.event_id WHERE e.application_id=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT 100",
        [appId],
      );
      return { deliveries: result.rows };
    } catch (cause) {
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook delivery listing failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    }
  });

  app.post<{ Params: WebhookRouteParams }>(collectionPath, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    if (!options.secretEncryptionKey || options.secretEncryptionKey.length !== 32) return reply.code(503).send(error("WEBHOOKS_NOT_CONFIGURED", "Webhook secret protection is not configured"));
    const body = objectBody(request.body);
    const url = stringField(body, "url", 2048);
    const applicationName = stringField(body, "applicationName", 120);
    const description = optionalDescription(body["description"]);
    const events = parseEvents(body["events"]);
    if (!url || description === undefined || !events) return reply.code(400).send(error("INVALID_WEBHOOK", "A valid HTTPS URL, description, and supported event list are required"));
    try {
      await (options.resolveTarget ?? resolvePublicWebhookTarget)(url);
    } catch (cause) {
      const code = cause instanceof WebhookTargetError ? cause.code : "WEBHOOK_DESTINATION_UNAVAILABLE";
      return reply.code(422).send(error(code, "Webhook destination must resolve only to a public address"));
    }

    const actor = actorAccountId(request);
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await ensureActiveApplication(client, request.params, applicationName);
      if (!appId) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const webhookId = randomUUID();
      const secret = `whsec_${randomBytes(32).toString("base64url")}`;
      const encrypted = encryptWebhookSecret(options.secretEncryptionKey, secret);
      const inserted = await client.query<WebhookRow>(
        "INSERT INTO sandbox_webhook_endpoints (id, application_id, url, description, events, active, secret_nonce, secret_ciphertext, secret_tag, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,now(),now()) RETURNING id,url,description,events,active,created_at,updated_at",
        [webhookId, appId, url, description, events, encrypted.nonce, encrypted.ciphertext, encrypted.tag],
      );
      await writeAudit(client, request, actor!, "webhook.created", appId, { webhookId });
      await client.query("COMMIT");
      return reply.code(201).send({ webhook: publicWebhook(inserted.rows[0]!), signingSecret: secret });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook creation failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: Required<WebhookRouteParams> }>(`${collectionPath}/:webhookId/test`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.webhookId)) return reply.code(400).send(error("INVALID_WEBHOOK", "Webhook identifiers are invalid"));
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const endpoint = await client.query<{ readonly id: string }>("SELECT id FROM sandbox_webhook_endpoints WHERE id=$1 AND application_id=$2 AND active=true AND deleted_at IS NULL FOR UPDATE", [request.params.webhookId, appId]);
      if (!endpoint.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("WEBHOOK_NOT_FOUND", "Active webhook endpoint not found"));
      }
      const eventId = randomUUID();
      const deliveryId = randomUUID();
      await client.query("INSERT INTO sandbox_events (id,application_id,event_type,aggregate_id,data,created_at) VALUES ($1,$2,'webhook.test',$1,$3,now())", [eventId, appId, JSON.stringify({ test: true })]);
      await client.query("INSERT INTO sandbox_webhook_deliveries (id,endpoint_id,event_id,status,attempts,available_at,created_at,updated_at) VALUES ($1,$2,$3,'pending',0,now(),now(),now())", [deliveryId, endpoint.rows[0].id, eventId]);
      await writeAudit(client, request, actorAccountId(request)!, "webhook.test_queued", appId, { webhookId: request.params.webhookId, deliveryId });
      await client.query("COMMIT");
      return reply.code(202).send({ deliveryId, eventId, status: "pending" });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook test enqueue failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: Required<WebhookRouteParams> & { readonly deliveryId: string } }>(`${collectionPath}/:webhookId/deliveries/:deliveryId/retry`, async (request, reply) => {
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.webhookId) || !uuidPattern.test(request.params.deliveryId)) return reply.code(400).send(error("INVALID_DELIVERY", "Webhook delivery identifiers are invalid"));
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const result = await client.query<{ readonly id: string }>("UPDATE sandbox_webhook_deliveries d SET status='pending',attempts=0,available_at=now(),locked_until=NULL,last_error_code=NULL,updated_at=now() FROM sandbox_webhook_endpoints e WHERE d.endpoint_id=e.id AND e.id=$1 AND e.application_id=$2 AND e.active=true AND e.deleted_at IS NULL AND d.id=$3 AND d.status='failed' RETURNING d.id", [request.params.webhookId, appId, request.params.deliveryId]);
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(409).send(error("DELIVERY_NOT_RETRYABLE", "Only failed deliveries for an active endpoint can be retried"));
      }
      await writeAudit(client, request, actorAccountId(request)!, "webhook.delivery_retried", appId, { webhookId: request.params.webhookId, deliveryId: request.params.deliveryId });
      await client.query("COMMIT");
      return reply.code(202).send({ deliveryId: request.params.deliveryId, status: "pending" });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook retry failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.patch<{ Params: Required<WebhookRouteParams> }>(`${collectionPath}/:webhookId`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.webhookId)) return reply.code(400).send(error("INVALID_WEBHOOK", "Webhook identifiers are invalid"));
    const body = objectBody(request.body);
    const changes = parsePatch(body);
    if (!changes) return reply.code(400).send(error("INVALID_WEBHOOK", "Provide a valid URL, event list, description, or active state"));
    if (changes.url) {
      try { await (options.resolveTarget ?? resolvePublicWebhookTarget)(changes.url); }
      catch (cause) {
        const code = cause instanceof WebhookTargetError ? cause.code : "WEBHOOK_DESTINATION_UNAVAILABLE";
        return reply.code(422).send(error(code, "Webhook destination must resolve only to a public address"));
      }
    }
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const result = await client.query<WebhookRow>(
        "UPDATE sandbox_webhook_endpoints SET url=COALESCE($3,url), description=COALESCE($4,description), events=COALESCE($5,events), active=COALESCE($6,active), updated_at=now() WHERE id=$1 AND application_id=$2 AND deleted_at IS NULL RETURNING id,url,description,events,active,created_at,updated_at",
        [request.params.webhookId, appId, changes.url, changes.description, changes.events, changes.active],
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("WEBHOOK_NOT_FOUND", "Webhook endpoint not found"));
      }
      if (changes.active === false) await client.query("UPDATE sandbox_webhook_deliveries SET status='cancelled',locked_until=NULL,last_error_code='ENDPOINT_DISABLED',updated_at=now() WHERE endpoint_id=$1 AND status='pending'", [request.params.webhookId]);
      await writeAudit(client, request, actorAccountId(request)!, "webhook.updated", appId, { webhookId: request.params.webhookId });
      await client.query("COMMIT");
      return { webhook: publicWebhook(result.rows[0]) };
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook update failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.delete<{ Params: Required<WebhookRouteParams> }>(`${collectionPath}/:webhookId`, async (request, reply) => {
    const denied = authorize(request, options.controlToken);
    if (denied) return reply.code(denied.status).send(denied.body);
    if (!validRefs(request.params) || !uuidPattern.test(request.params.webhookId)) return reply.code(400).send(error("INVALID_WEBHOOK", "Webhook identifiers are invalid"));
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const appId = await lockApplication(client, request.params);
      if (!appId) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const result = await client.query<{ readonly id: string }>(
        "UPDATE sandbox_webhook_endpoints SET active=false, deleted_at=now(), updated_at=now() WHERE id=$1 AND application_id=$2 AND deleted_at IS NULL RETURNING id",
        [request.params.webhookId, appId],
      );
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("WEBHOOK_NOT_FOUND", "Webhook endpoint not found"));
      }
      await client.query("UPDATE sandbox_webhook_deliveries SET status='cancelled',locked_until=NULL,last_error_code='ENDPOINT_DELETED',updated_at=now() WHERE endpoint_id=$1 AND status='pending'", [request.params.webhookId]);
      await writeAudit(client, request, actorAccountId(request)!, "webhook.deleted", appId, { webhookId: request.params.webhookId });
      await client.query("COMMIT");
      return reply.code(204).send();
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox webhook deletion failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });
}
