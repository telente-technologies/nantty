import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

import { createSandboxCredential } from "./credentials.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CredentialControlOptions {
  readonly database: Pool;
  readonly controlToken: string;
}

interface CredentialRouteParams {
  readonly organizationId: string;
  readonly applicationId: string;
  readonly credentialId?: string;
}

interface CredentialRecord {
  readonly id: string;
  readonly application_id: string;
  readonly token_hash?: string;
  readonly token_prefix: string;
  readonly created_at: Date;
  readonly last_used_at: Date | null;
  readonly expires_at: Date | null;
  readonly revoked_at: Date | null;
}

export function registerCredentialControlRoutes(app: FastifyInstance, options: CredentialControlOptions): void {
  const route = "/v1/control/organizations/:organizationId/applications/:applicationId/credentials";
  app.get<{ Params: CredentialRouteParams }>(route, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    if (!isControlRequest(request, options.controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    const actorAccountId = request.headers["x-nantty-actor-account-id"];
    if (typeof actorAccountId !== "string" || !uuidPattern.test(actorAccountId)) return reply.code(400).send(error("INVALID_ACTOR", "An authorized account identifier is required"));
    if (!validApplicationRef(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    try {
      const application = await options.database.query<{ readonly id: string }>("SELECT id FROM sandbox_applications WHERE organization_id=$1 AND external_application_id=$2 AND status='active'", [request.params.organizationId, request.params.applicationId]);
      if (!application.rows[0]) return { credentials: [] };
      const result = await options.database.query<Omit<CredentialRecord, "token_hash" | "application_id">>(
        "SELECT id, token_prefix, created_at, last_used_at, expires_at, revoked_at FROM sandbox_credentials WHERE application_id=$1 ORDER BY created_at DESC, id DESC LIMIT 100",
        [application.rows[0].id],
      );
      return { credentials: result.rows.map(toPublicCredential) };
    } catch (cause) {
      request.log.error({ cause, requestId: request.id }, "Sandbox credential listing failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    }
  });

  app.post<{ Params: CredentialRouteParams }>(route, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    if (!isControlRequest(request, options.controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    const actorAccountId = request.headers["x-nantty-actor-account-id"];
    if (typeof actorAccountId !== "string" || !uuidPattern.test(actorAccountId)) return reply.code(400).send(error("INVALID_ACTOR", "An authorized account identifier is required"));
    if (!validApplicationRef(request.params)) return reply.code(400).send(error("INVALID_APPLICATION", "Application identifiers are invalid"));
    const name = applicationName(request.body);
    if (!name) return reply.code(400).send(error("INVALID_APPLICATION", "Application name is invalid"));
    const expiresAt = parseExpiry(request.body);
    if (expiresAt === undefined) return reply.code(400).send(error("INVALID_EXPIRY", "Expiration must be a future timestamp or null"));
    const issued = createSandboxCredential();
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const application = await upsertApplication(client, request.params.organizationId, request.params.applicationId, name);
      if (!application) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const credentialId = randomUUID();
      await insertCredential(client, credentialId, application.id, issued.tokenHash, issued.prefix, expiresAt);
      await writeCredentialAudit(client, request, actorAccountId, "credential.issued", application.id, { credentialId });
      await client.query("COMMIT");
      return reply.code(201).send({ ...toPublicCredential({ id: credentialId, token_prefix: issued.prefix, created_at: new Date(), last_used_at: null, expires_at: expiresAt, revoked_at: null }), environment: "sandbox", token: issued.token });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox credential issuance failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.post<{ Params: Required<CredentialRouteParams> }>(`${route}/:credentialId/rotate`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    if (!isControlRequest(request, options.controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    const actorAccountId = request.headers["x-nantty-actor-account-id"];
    if (typeof actorAccountId !== "string" || !uuidPattern.test(actorAccountId)) return reply.code(400).send(error("INVALID_ACTOR", "An authorized account identifier is required"));
    if (!validApplicationRef(request.params) || !uuidPattern.test(request.params.credentialId)) return reply.code(400).send(error("INVALID_CREDENTIAL", "Credential identifiers are invalid"));
    const expiresAt = parseExpiry(request.body);
    if (expiresAt === undefined) return reply.code(400).send(error("INVALID_EXPIRY", "Expiration must be a future timestamp or null"));
    const issued = createSandboxCredential();
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const application = await lockActiveApplication(client, request.params.organizationId, request.params.applicationId);
      if (!application) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const prior = await client.query<{ readonly id: string }>("UPDATE sandbox_credentials SET revoked_at=now() WHERE id=$1 AND application_id=$2 AND revoked_at IS NULL RETURNING id", [request.params.credentialId, application.id]);
      if (!prior.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("CREDENTIAL_NOT_FOUND", "Active sandbox credential not found"));
      }
      const credentialId = randomUUID();
      await insertCredential(client, credentialId, application.id, issued.tokenHash, issued.prefix, expiresAt);
      await writeCredentialAudit(client, request, actorAccountId, "credential.rotated", application.id, { revokedCredentialId: request.params.credentialId, issuedCredentialId: credentialId });
      await client.query("COMMIT");
      return reply.code(201).send({ ...toPublicCredential({ id: credentialId, token_prefix: issued.prefix, created_at: new Date(), last_used_at: null, expires_at: expiresAt, revoked_at: null }), environment: "sandbox", token: issued.token });
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox credential rotation failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });

  app.delete<{ Params: Required<CredentialRouteParams> }>(`${route}/:credentialId`, async (request, reply) => {
    reply.header("Cache-Control", "no-store, max-age=0");
    if (!isControlRequest(request, options.controlToken)) return reply.code(401).send(error("UNAUTHORIZED", "Control authorization required"));
    const actorAccountId = request.headers["x-nantty-actor-account-id"];
    if (typeof actorAccountId !== "string" || !uuidPattern.test(actorAccountId)) return reply.code(400).send(error("INVALID_ACTOR", "An authorized account identifier is required"));
    if (!validApplicationRef(request.params) || !uuidPattern.test(request.params.credentialId)) return reply.code(400).send(error("INVALID_CREDENTIAL", "Credential identifiers are invalid"));
    const client = await options.database.connect();
    try {
      await client.query("BEGIN");
      const application = await lockActiveApplication(client, request.params.organizationId, request.params.applicationId);
      if (!application) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("APPLICATION_NOT_FOUND", "Active sandbox application not found"));
      }
      const result = await client.query<{ readonly id: string }>("UPDATE sandbox_credentials SET revoked_at=now() WHERE id=$1 AND application_id=$2 AND revoked_at IS NULL RETURNING id", [request.params.credentialId, application.id]);
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send(error("CREDENTIAL_NOT_FOUND", "Active sandbox credential not found"));
      }
      await writeCredentialAudit(client, request, actorAccountId, "credential.revoked", application.id, { credentialId: request.params.credentialId });
      await client.query("COMMIT");
      return reply.code(204).send();
    } catch (cause) {
      await rollback(client);
      request.log.error({ cause, requestId: request.id }, "Sandbox credential revocation failed");
      return reply.code(503).send(error("SANDBOX_UNAVAILABLE", "Sandbox storage is unavailable"));
    } finally {
      client.release();
    }
  });
}

async function lockActiveApplication(client: PoolClient, organizationId: string, applicationId: string): Promise<{ readonly id: string } | null> {
  const result = await client.query<{ readonly id: string }>("SELECT id FROM sandbox_applications WHERE organization_id=$1 AND external_application_id=$2 AND status='active' FOR UPDATE", [organizationId, applicationId]);
  return result.rows[0] ?? null;
}

async function upsertApplication(client: PoolClient, organizationId: string, applicationId: string, name: string): Promise<{ readonly id: string } | null> {
  const result = await client.query<{ readonly id: string }>(
    "INSERT INTO sandbox_applications (id, organization_id, external_application_id, name, status, created_at) VALUES ($1,$2,$3,$4,'active',now()) ON CONFLICT (organization_id,external_application_id) DO UPDATE SET name=EXCLUDED.name WHERE sandbox_applications.status='active' RETURNING id",
    [randomUUID(), organizationId, applicationId, name],
  );
  return result.rows[0] ?? null;
}

async function insertCredential(client: PoolClient, id: string, applicationId: string, tokenHash: string, prefix: string, expiresAt: Date | null): Promise<void> {
  await client.query("INSERT INTO sandbox_credentials (id, application_id, token_hash, token_prefix, created_at, expires_at) VALUES ($1,$2,$3,$4,now(),$5)", [id, applicationId, tokenHash, prefix, expiresAt]);
}

async function writeCredentialAudit(client: PoolClient, request: FastifyRequest, actorAccountId: string, action: string, applicationId: string, metadata: Record<string, string>): Promise<void> {
	await client.query("INSERT INTO sandbox_control_audit (id, actor, action, application_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,now())", [randomUUID(), actorAccountId, action, applicationId, JSON.stringify({ ...metadata, requestId: request.id })]);
}

function toPublicCredential(row: Omit<CredentialRecord, "token_hash" | "application_id">) {
  return { id: row.id, prefix: row.token_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at, expiresAt: row.expires_at, revokedAt: row.revoked_at };
}

function parseExpiry(value: unknown): Date | null | undefined {
  const body = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const raw = body["expiresAt"];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || raw.length > 40) return undefined;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now() + 60_000) return undefined;
  return new Date(timestamp);
}

function validApplicationRef(params: CredentialRouteParams): boolean {
  return uuidPattern.test(params.organizationId) && uuidPattern.test(params.applicationId);
}

function applicationName(value: unknown): string | null {
  const body = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const name = body["name"];
  if (typeof name !== "string") return null;
  const normalized = name.trim();
  return normalized.length > 0 && normalized.length <= 120 ? normalized : null;
}

function isControlRequest(request: FastifyRequest, expected: string): boolean {
  const token = request.headers.authorization?.match(/^Bearer ([^\s]{1,512})$/)?.[1];
  if (!token) return false;
  const candidate = Buffer.from(token);
  const configured = Buffer.from(expected);
  return candidate.length === configured.length && timingSafeEqual(candidate, configured);
}

function error(code: string, message: string) {
  return { error: { code, message } };
}

async function rollback(client: PoolClient): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { return; }
}
