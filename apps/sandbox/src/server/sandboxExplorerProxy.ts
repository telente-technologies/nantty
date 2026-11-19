import { NextRequest, NextResponse } from "next/server";

import { jsonError, readJsonBody, readPortalToken, safeBaseUrl, verifyCsrf } from "./sandboxPortalProxy";

const sandboxTokenPattern = /^ntsb_test_[A-Za-z0-9_-]{32,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ExplorerOperation = "create_customer" | "create_conversation" | "list_messages" | "send_message" | "send_test_event";

export async function forwardSandboxExplorer(request: NextRequest): Promise<NextResponse> {
  const sandboxBase = safeBaseUrl(process.env.SANDBOX_API_BASE_URL, true);
  if (!sandboxBase) return jsonError(503, "SANDBOX_NOT_CONFIGURED", "Sandbox API explorer is temporarily unavailable. Try again shortly.");
  const accessToken = readPortalToken(request);
  if (!accessToken) {
    return jsonError(
      process.env.NODE_ENV === "production" ? 503 : 401,
      process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED",
      process.env.NODE_ENV === "production" ? "Sign-in is temporarily unavailable. Try again shortly." : "Sign in to Nantty to run Sandbox API requests.",
    );
  }
  if (!verifyCsrf(request)) return jsonError(403, "CSRF_REJECTED", "Request origin could not be verified.");

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const token = typeof body["token"] === "string" ? body["token"].trim() : "";
  if (!sandboxTokenPattern.test(token)) {
    return jsonError(401, "INVALID_SANDBOX_CREDENTIAL", "Provide a sandbox credential starting with ntsb_test_. Production credentials are never accepted.");
  }

  const operation = typeof body["operation"] === "string" ? body["operation"] as ExplorerOperation : "";
  const conversationId = typeof body["conversationId"] === "string" ? body["conversationId"].trim() : "";
  const idempotencyKey = typeof body["idempotencyKey"] === "string" ? body["idempotencyKey"].trim() : "";
  const payload = typeof body["payload"] === "object" && body["payload"] !== null && !Array.isArray(body["payload"]) ? body["payload"] : {};

  let method = "POST";
  let path = "";
  let sendBody: string | undefined = JSON.stringify(payload);

  if (operation === "create_customer") path = "/v1/customers";
  else if (operation === "create_conversation") path = "/v1/conversations";
  else if (operation === "list_messages") {
    if (!uuidPattern.test(conversationId)) return jsonError(400, "INVALID_CONVERSATION", "Provide a valid conversation UUID.");
    method = "GET"; path = `/v1/conversations/${conversationId}/messages`; sendBody = undefined;
  } else if (operation === "send_message") {
    if (!uuidPattern.test(conversationId)) return jsonError(400, "INVALID_CONVERSATION", "Provide a valid conversation UUID.");
    if (!idempotencyKey) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "Provide an idempotency key for outbound messages.");
    path = `/v1/conversations/${conversationId}/messages`;
  } else if (operation === "send_test_event") path = "/v1/webhooks/test-events";
  else return jsonError(400, "INVALID_OPERATION", "Choose a documented sandbox operation.");

  try {
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
    if (sendBody !== undefined) headers["content-type"] = "application/json";
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

    const upstream = await fetch(new URL(path, sandboxBase), {
      method,
      headers,
      ...(sendBody !== undefined ? { body: sendBody } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await upstream.text();
    let responseJson: unknown = text;
    try { responseJson = JSON.parse(text); } catch { /* leave text */ }
    return NextResponse.json(
      {
        status: upstream.status,
        requestId: upstream.headers.get("x-request-id"),
        idempotentReplayed: upstream.headers.get("idempotent-replayed") === "true",
        body: responseJson,
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return jsonError(502, "SANDBOX_UNAVAILABLE", "Could not execute request against Sandbox API gateway.");
  }
}
