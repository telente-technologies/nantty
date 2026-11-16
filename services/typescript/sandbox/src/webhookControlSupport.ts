import { createCipheriv, createDecipheriv, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedEvents = new Set(["message.received", "message.delivered", "message.read", "message.failed"]);

export interface WebhookRouteParams {
  readonly organizationId: string;
  readonly applicationId: string;
  readonly webhookId?: string;
}

export interface WebhookRow {
  readonly id: string;
  readonly url: string;
  readonly description: string;
  readonly events: readonly string[];
  readonly active: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export function authorize(request: FastifyRequest, token: string): { readonly status: 401 | 400; readonly body: ReturnType<typeof error> } | null {
  if (!hasControlToken(request, token)) return { status: 401, body: error("UNAUTHORIZED", "Control authorization required") };
  if (!actorAccountId(request)) return { status: 400, body: error("INVALID_ACTOR", "An authorized account identifier is required") };
  return null;
}

function hasControlToken(request: FastifyRequest, expected: string): boolean {
  const token = request.headers.authorization?.match(/^Bearer ([^\s]{1,512})$/)?.[1];
  if (!token) return false;
  const candidate = Buffer.from(token);
  const configured = Buffer.from(expected);
  return candidate.length === configured.length && timingSafeEqual(candidate, configured);
}

export function actorAccountId(request: FastifyRequest): string | null {
  const value = request.headers["x-nantty-actor-account-id"];
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

export function validRefs(params: WebhookRouteParams): boolean {
  return uuidPattern.test(params.organizationId) && uuidPattern.test(params.applicationId);
}

export async function findApplication(database: Pool, params: WebhookRouteParams): Promise<string | null> {
  const result = await database.query<{ readonly id: string }>("SELECT id FROM sandbox_applications WHERE organization_id=$1 AND external_application_id=$2 AND status='active'", [params.organizationId, params.applicationId]);
  return result.rows[0]?.id ?? null;
}

export async function lockApplication(client: PoolClient, params: WebhookRouteParams): Promise<string | null> {
  const result = await client.query<{ readonly id: string }>("SELECT id FROM sandbox_applications WHERE organization_id=$1 AND external_application_id=$2 AND status='active' FOR UPDATE", [params.organizationId, params.applicationId]);
  return result.rows[0]?.id ?? null;
}

export async function ensureActiveApplication(client: PoolClient, params: WebhookRouteParams, applicationName: string | null): Promise<string | null> {
  const existing = await lockApplication(client, params);
  if (existing || !applicationName) return existing;
  const result = await client.query<{ readonly id: string }>(
    "INSERT INTO sandbox_applications (id,organization_id,external_application_id,name,status,created_at) VALUES ($1,$2,$3,$4,'active',now()) ON CONFLICT (organization_id,external_application_id) DO UPDATE SET name=EXCLUDED.name WHERE sandbox_applications.status='active' RETURNING id",
    [randomUUID(), params.organizationId, params.applicationId, applicationName],
  );
  return result.rows[0]?.id ?? null;
}

export async function writeAudit(client: PoolClient, request: FastifyRequest, actor: string, action: string, appId: string, metadata: Record<string, string>): Promise<void> {
  await client.query("INSERT INTO sandbox_control_audit (id, actor, action, application_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,now())", [randomUUID(), actor, action, appId, JSON.stringify({ ...metadata, requestId: request.id })]);
}

export function encryptWebhookSecret(key: Buffer, secret: string): { readonly nonce: Buffer; readonly ciphertext: Buffer; readonly tag: Buffer } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { nonce, ciphertext, tag: cipher.getAuthTag() };
}

export function decryptWebhookSecret(key: Buffer, encrypted: { readonly nonce: Buffer; readonly ciphertext: Buffer; readonly tag: Buffer }): string {
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce);
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString("utf8");
}

export function parseEvents(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > allowedEvents.size) return null;
  const events = value.map((event) => typeof event === "string" ? event : "");
  return events.every((event) => allowedEvents.has(event)) && new Set(events).size === events.length ? events : null;
}

export function optionalDescription(value: unknown): string | null | undefined {
  if (value === undefined) return "";
  if (typeof value !== "string") return undefined;
  const description = value.trim();
  return description.length <= 80 ? description : undefined;
}

export function parsePatch(body: Record<string, unknown>): { readonly url?: string; readonly description?: string; readonly events?: string[]; readonly active?: boolean } | null {
  const changes: { url?: string; description?: string; events?: string[]; active?: boolean } = {};
  if ("url" in body) {
    if (typeof body["url"] !== "string" || body["url"].trim().length === 0 || body["url"].length > 2048) return null;
    changes.url = body["url"].trim();
  }
  if ("description" in body) {
    const description = optionalDescription(body["description"]);
    if (description === undefined) return null;
    changes.description = description ?? "";
  }
  if ("events" in body) {
    const events = parseEvents(body["events"]);
    if (!events) return null;
    changes.events = events;
  }
  if ("active" in body) {
    if (typeof body["active"] !== "boolean") return null;
    changes.active = body["active"];
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export function publicWebhook(row: WebhookRow) {
  return { id: row.id, url: row.url, description: row.description, events: row.events, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function objectBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function stringField(value: Record<string, unknown>, key: string, maximumLength: number): string | null {
  const candidate = value[key];
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return normalized.length > 0 && normalized.length <= maximumLength ? normalized : null;
}

export function error(code: string, message: string) {
  return { error: { code, message } };
}

export async function rollback(client: PoolClient): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { return; }
}
