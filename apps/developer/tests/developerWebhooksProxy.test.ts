import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { NextRequest } from "next/server";

import { forwardDeveloperWebhookRequest } from "../src/server/developerWebhooksProxy";

const savedEnvironment = Object.fromEntries(["NODE_ENV", "DEVELOPER_API_BASE_URL", "SANDBOX_API_BASE_URL", "SANDBOX_CONTROL_TOKEN"].map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const organizationId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
const applicationId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
const webhookId = "a2d7f00d-9587-4cb8-91d4-592f43301f36";
const actorAccountId = "3fbcd9fc-dab8-4e3e-a832-209ae7ffbb5d";
const sessionToken = "local-session-secret";
const controlToken = "server-only-sandbox-control-token-long-enough";

afterEach(() => {
  for (const [name, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});

function configure(): void {
  Reflect.set(process.env, "NODE_ENV", "development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  process.env.SANDBOX_API_BASE_URL = "http://localhost:3901";
  process.env.SANDBOX_CONTROL_TOKEN = controlToken;
}

function makeRequest(action: "list" | "deliveries" | "create" | "update" | "delete" | "test" | "retry", options: { readonly cookie?: boolean; readonly origin?: string; readonly capabilities?: string[] } = {}): NextRequest {
  const mutating = !["list", "deliveries"].includes(action);
  const route = action === "test" ? "/api/developer/webhooks/test" : action === "retry" ? "/api/developer/webhooks/retry" : action === "deliveries" ? "/api/developer/webhooks/deliveries" : "/api/developer/webhooks";
  const method = action === "list" || action === "deliveries" ? "GET" : action === "update" ? "PATCH" : action === "delete" ? "DELETE" : "POST";
  const url = new URL(route, "https://developers.nantty.test");
  if (!mutating) { url.searchParams.set("organizationId", organizationId); url.searchParams.set("applicationId", applicationId); }
  const headers = new Headers({ origin: options.origin ?? url.origin });
  if (options.cookie !== false) headers.set("cookie", `zd_webapp_at=${sessionToken}`);
  if (mutating) headers.set("content-type", "application/json");
  const payload = { organizationId, applicationId, webhookId, deliveryId: "f3770eb7-42a6-48ec-a606-174c03c54c50", url: "https://hooks.example.org/events", description: "CRM", events: ["message.received"], active: false };
  return new NextRequest(url, { method, headers, ...(mutating ? { body: JSON.stringify(payload) } : {}) });
}

function identityResponse(capabilities = ["webhooks.manage"], overrides: Record<string, unknown> = {}): Response {
  return Response.json({ actorAccountId, organizationId, applicationId, applicationName: "Nantty CRM", capabilities, ...overrides });
}

test("requires a signed-in user and webhooks.manage before contacting Sandbox", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return identityResponse(["applications.read"]); };
  const unauthenticated = await forwardDeveloperWebhookRequest(makeRequest("list", { cookie: false }), "list");
  assert.equal(unauthenticated.status, 401);
  const denied = await forwardDeveloperWebhookRequest(makeRequest("list"), "list");
  assert.equal(denied.status, 403);
  assert.equal(calls, 1);
});

test("lists webhooks only after exact application authorization and forwards actor, not browser credentials", async () => {
  configure();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return calls.length === 1 ? identityResponse() : Response.json({ webhooks: [] });
  };
  const response = await forwardDeveloperWebhookRequest(makeRequest("list"), "list");
  assert.equal(response.status, 200);
  const sandboxHeaders = new Headers(calls[1]?.init.headers);
  assert.equal(sandboxHeaders.get("authorization"), `Bearer ${controlToken}`);
  assert.equal(sandboxHeaders.get("x-nantty-actor-account-id"), actorAccountId);
  assert.equal(sandboxHeaders.has("cookie"), false);
  assert.match(calls[1]?.url ?? "", new RegExp(`/organizations/${organizationId}/applications/${applicationId}/webhooks$`));
});

test("creates endpoints without forwarding unknown input and returns one-time secret with no-store", async () => {
  configure();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return calls.length === 1 ? identityResponse() : Response.json({ webhook: { id: webhookId }, signingSecret: "whsec_once" }, { status: 201 });
  };
  const response = await forwardDeveloperWebhookRequest(makeRequest("create"), "create");
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal((await response.json()).signingSecret, "whsec_once");
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), { applicationName: "Nantty CRM", url: "https://hooks.example.org/events", description: "CRM", events: ["message.received"] });
});

test("rejects CSRF and mismatched Identity resources before calling Sandbox", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return identityResponse(); };
  const csrf = await forwardDeveloperWebhookRequest(makeRequest("create", { origin: "https://attacker.test" }), "create");
  assert.equal(csrf.status, 403);
  globalThis.fetch = async () => { calls += 1; return identityResponse(["webhooks.manage"], { applicationId: webhookId }); };
  const mismatch = await forwardDeveloperWebhookRequest(makeRequest("create"), "create");
  assert.equal(mismatch.status, 403);
  assert.equal(calls, 1);
});

test("queues test events and retries only through scoped Sandbox routes", async () => {
  configure();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return calls.length % 2 === 1 ? identityResponse() : Response.json({ status: "pending" }, { status: 202 });
  };
  const testResult = await forwardDeveloperWebhookRequest(makeRequest("test"), "test");
  assert.equal(testResult.status, 202);
  assert.match(calls[1]?.url ?? "", new RegExp(`/webhooks/${webhookId}/test$`));
  const retryResult = await forwardDeveloperWebhookRequest(makeRequest("retry"), "retry");
  assert.equal(retryResult.status, 202);
  assert.match(calls[3]?.url ?? "", /\/deliveries\/f3770eb7-42a6-48ec-a606-174c03c54c50\/retry$/);
});

test("hides internal gateway and environment configuration wording from webhook 503 messages", async () => {
  delete process.env.DEVELOPER_API_BASE_URL;
  const noIdentity = await forwardDeveloperWebhookRequest(makeRequest("list"), "list");
  assert.equal(noIdentity.status, 503);
  const noIdentityBody = await noIdentity.json();
  assert.doesNotMatch(String(noIdentityBody.message), /gateway|not configured|not connected|environment|deployment/i);

  configure();
  delete process.env.SANDBOX_CONTROL_TOKEN;
  const noSandbox = await forwardDeveloperWebhookRequest(makeRequest("list"), "list");
  assert.equal(noSandbox.status, 503);
  const noSandboxBody = await noSandbox.json();
  assert.doesNotMatch(String(noSandboxBody.message), /gateway|not configured|not connected|environment|deployment/i);
});
