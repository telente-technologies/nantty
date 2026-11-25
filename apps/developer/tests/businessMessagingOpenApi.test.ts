import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "../src/app/docs/openapi.json/route";
import { buildBusinessMessagingOpenApiSpec } from "../src/lib/businessMessagingOpenApi";

test("OpenAPI 3.1 distinguishes live Sandbox routes, consent-scoped Production reads, and unavailable sends", () => {
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
  const prodRoute = (spec.paths["/api/v1/business/messages"] as { post: { "x-status": string; responses: Record<string, unknown> } }).post;
  assert.equal(prodRoute["x-status"], "unavailable");
  assert.ok(prodRoute.responses["503"]);
  assert.equal(prodRoute.responses["202"], undefined);
  const prodConversations = (spec.paths["/api/v1/business/conversations"] as { get: { responses: Record<string, unknown>; parameters: Array<{ name: string }>; "x-status"?: string } }).get;
  assert.ok(prodConversations.responses["200"]);
  assert.equal(prodConversations.responses["503"], undefined);
  assert.equal(prodConversations["x-status"], undefined);
  assert.deepEqual(prodConversations.parameters.map(({ name }) => name), ["limit", "cursor"]);
  const historyPath = "/api/v1/business/conversations/{recipientId}/messages";
  const messageHistory = (spec.paths[historyPath] as { get: { security: Array<Record<string, string[]>>; responses: Record<string, unknown> } }).get;
  assert.equal(messageHistory.security[0]?.BusinessBearerAuth?.[0], "messages:read");
  assert.ok(messageHistory.responses["200"]);
  assert.ok(messageHistory.responses["403"]);
  const messageStatus = (spec.paths["/api/v1/business/messages/{messageId}"] as { get: { security: Array<Record<string, string[]>>; responses: Record<string, unknown> } }).get;
  assert.equal(messageStatus.security[0]?.BusinessBearerAuth?.[0], "messages:read");
  assert.ok(messageStatus.responses["404"]);
  const businessMessage = spec.components.schemas.BusinessMessage as { properties: { status: { enum: readonly string[] } } };
  assert.deepEqual(businessMessage.properties.status.enum, ["accepted", "dispatched", "failed"]);
  assert.match(spec.info.description, /inbound message synchronization.*not yet connected/i);
  const errorCodes = (spec.components.schemas.ErrorEnvelope as { properties: { error: { properties: { code: { enum: readonly string[] } } } } }).properties.error.properties.code.enum;
  assert.ok(errorCodes.includes("SANDBOX_QUOTA_EXCEEDED"));
  assert.ok(errorCodes.includes("INVALID_SANDBOX_CREDENTIAL"));
  assert.ok(errorCodes.includes("IDEMPOTENCY_CONFLICT"));
  assert.ok(errorCodes.includes("APPLICATION_NOT_APPROVED"));
  assert.ok(errorCodes.includes("MONTHLY_QUOTA_EXCEEDED"));
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
