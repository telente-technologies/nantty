import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { NextRequest } from "next/server";

import { forwardDeveloperCredentialRequest } from "../src/server/developerCredentialsProxy";

const savedEnvironment = Object.fromEntries(["NODE_ENV", "DEVELOPER_API_BASE_URL", "SANDBOX_API_BASE_URL", "SANDBOX_CONTROL_TOKEN"].map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const organizationId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
const applicationId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
const credentialId = "a2d7f00d-9587-4cb8-91d4-592f43301f36";
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

function makeRequest(action: "list" | "issue" | "revoke" | "rotate", options: { readonly cookie?: boolean; readonly origin?: string; readonly body?: unknown; readonly appId?: string } = {}): NextRequest {
  const path = action === "rotate" ? "/api/developer/credentials/rotate" : "/api/developer/credentials";
  const method = action === "list" ? "GET" : action === "revoke" ? "DELETE" : "POST";
  const url = new URL(path, "https://developers.nantty.test");
  if (action === "list") { url.searchParams.set("organizationId", organizationId); url.searchParams.set("applicationId", options.appId ?? applicationId); }
  const headers = new Headers({ origin: options.origin ?? url.origin });
  if (options.cookie !== false) headers.set("cookie", `zd_webapp_at=${sessionToken}`);
  if (method !== "GET") headers.set("content-type", "application/json");
  const body = method === "GET" ? undefined : JSON.stringify(options.body ?? { organizationId, applicationId: options.appId ?? applicationId, ...(action === "revoke" || action === "rotate" ? { credentialId } : {}), expiresAt: null });
  return new NextRequest(url, { method, headers, ...(body === undefined ? {} : { body }) });
}

function identityResponse(capabilities = ["credentials.manage"], overrides: Record<string, unknown> = {}): Response {
  return Response.json({ actorAccountId, organizationId, applicationId, applicationName: "Nantty CRM", capabilities, ...overrides });
}

test("rejects unauthenticated credential requests before contacting upstream services", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({}); };
  const response = await forwardDeveloperCredentialRequest(makeRequest("list", { cookie: false }), "list");
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("requires Identity credentials.manage capability before touching Sandbox", async () => {
  configure();
  const calls: string[] = [];
  globalThis.fetch = async (input) => { calls.push(String(input)); return identityResponse(["applications.read"]); };
  const response = await forwardDeveloperCredentialRequest(makeRequest("list"), "list");
  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /capabilities\/me$/);
});

test("lists metadata only after Identity authorizes the exact application", async () => {
  configure();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return calls.length === 1 ? identityResponse() : Response.json({ credentials: [{ id: credentialId, prefix: "ntsb_test_abcd", revokedAt: null }] });
  };
  const response = await forwardDeveloperCredentialRequest(makeRequest("list"), "list");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { credentials: [{ id: credentialId, prefix: "ntsb_test_abcd", revokedAt: null }] });
  const controlHeaders = new Headers(calls[1]?.init.headers);
  assert.equal(controlHeaders.get("authorization"), `Bearer ${controlToken}`);
  assert.equal(controlHeaders.get("x-nantty-actor-account-id"), actorAccountId);
  assert.equal(controlHeaders.has("cookie"), false);
  assert.match(calls[1]?.url ?? "", new RegExp(`/organizations/${organizationId}/applications/${applicationId}/credentials$`));
});

test("issues only sandbox secrets, returns them once with no-store, and never forwards the browser token to Sandbox", async () => {
  configure();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return calls.length === 1 ? identityResponse() : Response.json({ id: credentialId, prefix: "ntsb_test_abc", environment: "sandbox", token: "ntsb_test_one_time_secret" }, { status: 201 });
  };
  const response = await forwardDeveloperCredentialRequest(makeRequest("issue", { body: { organizationId, applicationId, expiresAt: null } }), "issue");
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal((await response.json()).token, "ntsb_test_one_time_secret");
  const sandboxRequest = calls[1]?.init;
  assert.equal(new Headers(sandboxRequest?.headers).get("authorization"), `Bearer ${controlToken}`);
  assert.deepEqual(JSON.parse(String(sandboxRequest?.body)), { name: "Nantty CRM", expiresAt: null });
  assert.match(calls[1]?.url ?? "", /sandbox-api|localhost/);
});

test("rejects cross-origin mutations and mismatched Identity resource responses", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return identityResponse(); };
  const csrf = await forwardDeveloperCredentialRequest(makeRequest("issue", { origin: "https://attacker.test" }), "issue");
  assert.equal(csrf.status, 403);
  assert.equal(calls, 0);

  globalThis.fetch = async () => { calls += 1; return identityResponse(["credentials.manage"], { applicationId: credentialId }); };
  const mismatch = await forwardDeveloperCredentialRequest(makeRequest("issue"), "issue");
  assert.equal(mismatch.status, 403);
  assert.equal(calls, 1);
});

test("rejects non-sandbox upstream hosts before forwarding credentials", async () => {
  configure();
  process.env.SANDBOX_API_BASE_URL = "https://api.nantty.com";
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({}); };
  const response = await forwardDeveloperCredentialRequest(makeRequest("list"), "list");
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});
