import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "../src/app/docs/openapi.json/route";
import { buildBusinessMessagingOpenApiSpec } from "../src/lib/businessMessagingOpenApi";

test("OpenAPI 3.1 specification covers implemented Sandbox Messaging routes and draft boundary", () => {
  const spec = buildBusinessMessagingOpenApiSpec();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/v1/customers"]);
  assert.ok(spec.paths["/v1/customers/{customerId}/conversations"]);
  assert.ok(spec.paths["/v1/conversations/{conversationId}/messages"]);
  assert.ok(spec.paths["/v1/events"]);
  assert.equal(spec.servers[0]?.url, process.env.SANDBOX_PUBLIC_API_URL ?? "http://localhost:8090");
  assert.notEqual(spec.servers[0]?.url, "http://localhost:3800");
  const postMessage = (spec.paths["/v1/conversations/{conversationId}/messages"] as { post: { responses: Record<string, unknown> } }).post;
  assert.ok(postMessage.responses["200"]);
  assert.ok(postMessage.responses["201"]);
  assert.ok(postMessage.responses["409"]);
  assert.ok(postMessage.responses["429"]);
  const draftRoute = (spec.paths["/v1/business/messages"] as { post: { "x-status": string } }).post;
  assert.equal(draftRoute["x-status"], "draft");
  const errorCodes = (spec.components.schemas.ErrorEnvelope as { properties: { error: { properties: { code: { enum: readonly string[] } } } } }).properties.error.properties.code.enum;
  assert.ok(errorCodes.includes("SANDBOX_QUOTA_EXCEEDED"));
  assert.ok(errorCodes.includes("INVALID_SANDBOX_CREDENTIAL"));
  assert.ok(errorCodes.includes("IDEMPOTENCY_CONFLICT"));
  assert.match((spec.components.schemas.WebhookEnvelope as { description: string }).description, /nantty-signature/);
  assert.match((spec.components.schemas.WebhookEnvelope as { description: string }).description, /nantty-event-id/);
});

test("OpenAPI route returns cacheable JSON payload", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=300/);
  const body = (await response.json()) as { openapi: string; components: { securitySchemes: Record<string, unknown> } };
  assert.equal(body.openapi, "3.1.0");
  assert.ok(body.components.securitySchemes.SandboxBearerAuth);
});
