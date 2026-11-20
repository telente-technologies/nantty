import { randomUUID, timingSafeEqual } from "node:crypto";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

import { registerSandboxInspectionRoutes } from "./controlInspectionRoutes.js";
import { registerCredentialControlRoutes } from "./credentialControl.js";
import { hashSandboxCredential, isSandboxCredentialFormat } from "./credentials.js";
import { registerSandboxMessagingRoutes, type SandboxPrincipal } from "./messagingRoutes.js";
import { incrementRequestUsage } from "./sandboxUsage.js";
import { registerSandboxWebhookControlRoutes } from "./webhookControl.js";
import { error, objectBody, rollback, stringField } from "./webhookControlSupport.js";
import { resolvePublicWebhookTarget } from "./webhookSecurity.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const bodyLimit = 64 * 1024;

interface AppOptions {
  readonly database: Pool;
  readonly controlToken: string;
  readonly secretEncryptionKey?: Buffer | null;
  readonly resolveWebhookTarget?: typeof resolvePublicWebhookTarget;
  readonly rateLimitMax?: number;
  readonly rateLimitWindowMs?: number;
}

export function createSandboxApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ bodyLimit, logger: false });
  const principals = new WeakMap<FastifyRequest, SandboxPrincipal>();

  void app.register(rateLimit, {
    global: true,
    max: options.rateLimitMax ?? 600,
    timeWindow: options.rateLimitWindowMs ?? 60_000,
  });

  app.setErrorHandler((cause, request, reply) => {
    const statusCode = typeof (cause as { statusCode?: unknown }).statusCode === "number" ? (cause as { statusCode: number }).statusCode : 500;
    if (statusCode === 429) {
      return reply.code(429).send(error("RATE_LIMITED", "Too many requests"));
    }
    request.log.error({ requestId: request.id, error: cause instanceof Error ? cause.message : String(cause) }, "Sandbox request failed");
    return reply.code(500).send(error("INTERNAL_ERROR", "Sandbox request could not be completed"));
  });

  void app.register(async (scoped) => {
    scoped.addHook("onResponse", async (request, reply) => {
      const appId = principals.get(request)?.appId ?? null;
      try {
        await options.database.query(
          "INSERT INTO sandbox_api_requests (request_id, application_id, method, path, status_code, created_at) VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (request_id) DO NOTHING",
          [request.id, appId, request.method, request.url.split("?", 1)[0], reply.statusCode],
        );
        if (appId) await incrementRequestUsage(options.database, appId);
      } catch {
        request.log.error({ requestId: request.id }, "Sandbox request audit write failed");
      }
    });

    scoped.addHook("preHandler", async (request, reply) => {
      const requestPath = request.url.split("?", 1)[0] ?? "";
      const hasTraversal = requestPath.includes("..") || requestPath.includes("\\") || /%2e/i.test(requestPath);
      if (!hasTraversal && (requestPath === "/readyz" || requestPath.startsWith("/v1/control/"))) return;
      const token = bearer(request.headers.authorization);
      if (!token || !isSandboxCredentialFormat(token)) return reply.code(401).send(error("INVALID_SANDBOX_CREDENTIAL", "A valid sandbox credential is required"));
      const result = await options.database.query<{ readonly id: string; readonly application_id: string }>(
        "SELECT c.id, c.application_id FROM sandbox_credentials c JOIN sandbox_applications a ON a.id = c.application_id WHERE c.token_hash = $1 AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now()) AND a.status = 'active'",
        [hashSandboxCredential(token)],
      );
      const credential = result.rows[0];
      if (!credential) return reply.code(401).send(error("INVALID_SANDBOX_CREDENTIAL", "A valid sandbox credential is required"));
      try {
        await options.database.query("UPDATE sandbox_credentials SET last_used_at=now() WHERE id=$1 AND revoked_at IS NULL", [credential.id]);
      } catch {
        request.log.warn({ requestId: request.id }, "Sandbox credential use time update failed");
      }
      principals.set(request, { credentialId: credential.id, appId: credential.application_id });
    });

    scoped.get("/readyz", async (_request, reply) => {
      try {
        await options.database.query("SELECT 1");
        const schema = await options.database.query<{ readonly ready: boolean }>("SELECT to_regclass('public.sandbox_applications') IS NOT NULL AS ready");
        if (!schema.rows[0]?.ready) return reply.code(503).send({ status: "not_ready" });
        return { status: "ready" };
      } catch {
        return reply.code(503).send({ status: "not_ready" });
      }
    });

    scoped.post("/v1/control/applications", async (request, reply) => {
      if (!isControlRequest(request, options.controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
      const body = objectBody(request.body);
      const organizationId = stringField(body, "organizationId", 128);
      const applicationId = stringField(body, "applicationId", 128);
      const name = stringField(body, "name", 120);
      if (!organizationId || !applicationId || !name || !identifierPattern.test(organizationId) || !identifierPattern.test(applicationId)) {
        return reply.code(400).send(error("INVALID_REQUEST", "Valid organizationId, applicationId, and name are required"));
      }
      const client = await options.database.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          "INSERT INTO sandbox_applications (id, organization_id, external_application_id, name, status, created_at) VALUES ($1, $2, $3, $4, 'active', now()) ON CONFLICT (organization_id, external_application_id) DO UPDATE SET name = EXCLUDED.name RETURNING id, organization_id AS \"organizationId\", external_application_id AS \"applicationId\", name, status",
          [randomUUID(), organizationId, applicationId, name],
        );
        await client.query("INSERT INTO sandbox_control_audit (id, actor, action, application_id, metadata, created_at) VALUES ($1, 'sandbox-control', 'application.provisioned', $2, $3, now())", [randomUUID(), result.rows[0].id, JSON.stringify({ organizationId, applicationId, requestId: request.id })]);
        await client.query("COMMIT");
        return reply.code(201).send(result.rows[0]);
      } catch (cause) {
        await rollback(client as PoolClient);
        request.log.error({ cause }, "Sandbox application persistence failed");
        return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
      } finally {
        client.release();
      }
    });

    registerCredentialControlRoutes(scoped, options);
    registerSandboxWebhookControlRoutes(scoped, {
      database: options.database,
      controlToken: options.controlToken,
      secretEncryptionKey: options.secretEncryptionKey ?? null,
      resolveTarget: options.resolveWebhookTarget,
    });
    registerSandboxMessagingRoutes(scoped, options.database, options.controlToken, principals);
    registerSandboxInspectionRoutes(scoped, options);
  });
  return app;
}

function isControlRequest(request: FastifyRequest, expected: string): boolean {
  const token = bearer(request.headers.authorization);
  if (!token) return false;
  const candidate = Buffer.from(token);
  const configured = Buffer.from(expected);
  return candidate.length === configured.length && timingSafeEqual(candidate, configured);
}

function bearer(value: string | undefined): string | null {
  const match = value?.match(/^Bearer ([^\s]{1,512})$/);
  return match?.[1] ?? null;
}
