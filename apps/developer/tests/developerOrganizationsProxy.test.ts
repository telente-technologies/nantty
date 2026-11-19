import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { NextRequest } from "next/server";

import { forwardDeveloperOrganizationRequest } from "../src/server/developerOrganizationsProxy";

const originalNodeEnv = process.env.NODE_ENV;
const originalApiBaseUrl = process.env.DEVELOPER_API_BASE_URL;
const originalFetch = globalThis.fetch;

function setNodeEnvironment(value: string): void {
  Reflect.set(process.env, "NODE_ENV", value);
}

afterEach(() => {
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else setNodeEnvironment(originalNodeEnv);
  if (originalApiBaseUrl === undefined) delete process.env.DEVELOPER_API_BASE_URL;
  else process.env.DEVELOPER_API_BASE_URL = originalApiBaseUrl;
  globalThis.fetch = originalFetch;
});

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://developers.nantty.test/api/developer/organizations", {
    method: "POST",
    headers: {
      cookie: "zd_webapp_at=local-session-secret",
      "content-type": "application/json",
      origin: "https://developers.nantty.test",
      ...headers,
    },
    body: JSON.stringify({ name: "Nantty test organization" }),
  });
}

test("rejects cross-origin organization mutations without contacting Identity", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({});
  };

  const response = await forwardDeveloperOrganizationRequest(makeRequest({ origin: "https://attacker.test" }));

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "CSRF_REJECTED");
  assert.equal(upstreamCalls, 0);
});

test("rejects cross-site organization mutations even when Origin matches", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({});
  };

  const response = await forwardDeveloperOrganizationRequest(makeRequest({ "sec-fetch-site": "cross-site" }));

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "CSRF_REJECTED");
  assert.equal(upstreamCalls, 0);
});

test("forwards same-origin authorized mutations without forwarding browser cookies", async () => {
  setNodeEnvironment("development");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let upstreamRequest: { url: URL; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    upstreamRequest = { url: new URL(String(input)), init: init ?? {} };
    return Response.json({ id: "organization-1" }, { status: 201 });
  };

  const response = await forwardDeveloperOrganizationRequest(makeRequest({ "idempotency-key": "create-org-request-0001" }));

  assert.equal(response.status, 201);
  assert.equal(upstreamRequest?.url.toString(), "https://identity.nantty.test/api/v1/developer/organizations");
  const headers = new Headers(upstreamRequest?.init.headers);
  assert.equal(headers.get("authorization"), "Bearer local-session-secret");
  assert.equal(headers.has("cookie"), false);
  assert.equal(headers.get("idempotency-key"), "create-org-request-0001");
  assert.deepEqual(JSON.parse(String(upstreamRequest?.init.body)), { name: "Nantty test organization" });
});

test("does not accept the local portal cookie as production SSO", async () => {
  setNodeEnvironment("production");
  process.env.DEVELOPER_API_BASE_URL = "https://identity.nantty.test";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({});
  };

  const response = await forwardDeveloperOrganizationRequest(makeRequest());

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "PORTAL_SSO_NOT_CONFIGURED");
  assert.equal(upstreamCalls, 0);
});

test("fails closed for non-HTTPS upstreams in production", async () => {
  setNodeEnvironment("production");
  process.env.DEVELOPER_API_BASE_URL = "http://identity.nantty.test";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return Response.json({});
  };

  const response = await forwardDeveloperOrganizationRequest(makeRequest({ cookie: "__Host-zd_at=account-session-secret" }));

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "DEVELOPER_API_NOT_CONFIGURED");
  assert.equal(upstreamCalls, 0);
});

test("allows invitation resend POST route only for valid UUIDs", async () => {
  const { isAllowedDeveloperOrganizationRoute } = await import("../src/server/developerOrganizationRoutePolicy");
  const orgId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
  const invId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
  assert.equal(isAllowedDeveloperOrganizationRoute("POST", [orgId, "invitations", invId, "resend"], "/api/v1/developer/organizations"), true);
  assert.equal(isAllowedDeveloperOrganizationRoute("GET", [orgId, "invitations", invId, "resend"], "/api/v1/developer/organizations"), false);
  assert.equal(isAllowedDeveloperOrganizationRoute("POST", [orgId, "invitations", "not-a-uuid", "resend"], "/api/v1/developer/organizations"), false);
});

test("hides developer configuration details from ordinary portal 503 messages", async () => {
  setNodeEnvironment("production");
  delete process.env.DEVELOPER_API_BASE_URL;
  const response = await forwardDeveloperOrganizationRequest(makeRequest({ cookie: "__Host-zd_at=account-session-secret" }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "DEVELOPER_API_NOT_CONFIGURED");
  assert.doesNotMatch(String(body.message), /gateway|not configured|not connected|environment|deployment/i);
});
