import { NextRequest, NextResponse } from "next/server";

const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBodyBytes = 4 * 1024;

type WebhookAction = "list" | "deliveries" | "create" | "update" | "delete" | "test" | "retry";

interface WebhookRequest {
  readonly organizationId: string;
  readonly applicationId: string;
  readonly webhookId?: string;
  readonly deliveryId?: string;
}

interface EffectiveApplicationCapabilities {
  readonly actorAccountId: string;
  readonly organizationId: string;
  readonly applicationId: string;
  readonly applicationName: string;
  readonly capabilities: readonly string[];
}

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function safeBaseUrl(value: string | undefined, sandbox: boolean): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const localHttp = process.env.NODE_ENV !== "production" && url.protocol === "http:" && localHost;
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) return null;
    if (sandbox) {
      const approvedSandboxHost = url.hostname === "sandbox-api.nantty.com" || url.hostname.endsWith(".sandbox.nantty.com");
      const localSandboxHost = process.env.NODE_ENV !== "production" && localHost;
      if (!approvedSandboxHost && !localSandboxHost) return null;
    }
    return url;
  } catch {
    return null;
  }
}

function readInput(request: NextRequest, action: WebhookAction): Record<string, unknown> {
  if (action === "list" || action === "deliveries") {
    return { organizationId: request.nextUrl.searchParams.get("organizationId") ?? "", applicationId: request.nextUrl.searchParams.get("applicationId") ?? "" };
  }
  return {};
}

export async function forwardDeveloperWebhookRequest(request: NextRequest, action: WebhookAction): Promise<NextResponse> {
  const identityBase = safeBaseUrl(process.env.DEVELOPER_API_BASE_URL, false);
  const sandboxBase = safeBaseUrl(process.env.SANDBOX_API_BASE_URL, true);
  const controlToken = process.env.SANDBOX_CONTROL_TOKEN?.trim();
  if (!identityBase) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "The Nantty API gateway is not configured for this portal.");
  if (!sandboxBase || !controlToken || controlToken.length < 32) return jsonError(503, "SANDBOX_WEBHOOKS_NOT_CONFIGURED", "Sandbox webhook management is not connected.");

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) return jsonError(process.env.NODE_ENV === "production" ? 503 : 401, process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED", process.env.NODE_ENV === "production" ? "Centralized Nantty sign-in is not connected to this portal yet." : "Sign in to Nantty to manage webhooks.");
  if (!isRead(action) && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return jsonError(403, "CSRF_REJECTED", "This webhook request could not be verified. Reload the page and try again.");

  let body: Record<string, unknown>;
  if (isRead(action)) body = readInput(request, action);
  else {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send webhook changes as JSON.");
    const reader = request.body?.getReader();
    if (!reader) return jsonError(400, "INVALID_JSON", "The request body must be a JSON object.");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maximumBodyBytes) {
          await reader.cancel();
          return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
        }
        chunks.push(value);
      }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (typeof value !== "object" || value === null || Array.isArray(value)) return jsonError(400, "INVALID_JSON", "The request body must be a JSON object.");
      body = value as Record<string, unknown>;
    } catch {
      return jsonError(400, "INVALID_JSON", "The request body must be valid JSON.");
    } finally {
      reader.releaseLock();
    }
  }

  const input: WebhookRequest = {
    organizationId: typeof body["organizationId"] === "string" ? body["organizationId"] : "",
    applicationId: typeof body["applicationId"] === "string" ? body["applicationId"] : "",
    ...(typeof body["webhookId"] === "string" ? { webhookId: body["webhookId"] } : {}),
    ...(typeof body["deliveryId"] === "string" ? { deliveryId: body["deliveryId"] } : {}),
  };
  if (!uuidPattern.test(input.organizationId) || !uuidPattern.test(input.applicationId)) return jsonError(400, "INVALID_APPLICATION", "Choose a valid organization and application.");
  if (["update", "delete", "test", "retry"].includes(action) && (!input.webhookId || !uuidPattern.test(input.webhookId))) return jsonError(400, "INVALID_WEBHOOK", "Choose a valid webhook endpoint.");
  if (action === "retry" && (!input.deliveryId || !uuidPattern.test(input.deliveryId))) return jsonError(400, "INVALID_DELIVERY", "Choose a valid webhook delivery.");

  const identityUrl = new URL(`/api/v1/developer/organizations/${input.organizationId}/applications/${input.applicationId}/capabilities/me`, identityBase);
  try {
    const identityResponse = await fetch(identityUrl, { headers: { accept: "application/json", authorization: `Bearer ${accessToken}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    if (identityResponse.status === 401) return jsonError(401, "UNAUTHENTICATED", "Your Nantty session has expired. Sign in again.");
    if (identityResponse.status === 403) return jsonError(403, "FORBIDDEN", "You do not have permission to manage webhooks for this application.");
    if (identityResponse.status === 404) return jsonError(404, "APPLICATION_NOT_FOUND", "This application is not available to your organization.");
    if (!identityResponse.ok) return jsonError(502, "IDENTITY_UNAVAILABLE", "Application permissions could not be confirmed.");
    const access = await identityResponse.json() as EffectiveApplicationCapabilities;
    if (!uuidPattern.test(access.actorAccountId) || access.organizationId !== input.organizationId || access.applicationId !== input.applicationId) return jsonError(403, "RESOURCE_MISMATCH", "Application access could not be confirmed.");
    if (!access.capabilities.includes("webhooks.manage")) return jsonError(403, "FORBIDDEN", "You do not have permission to manage webhooks for this application.");
    if (action === "create" && (!access.applicationName || access.applicationName.length > 120)) return jsonError(502, "INVALID_APPLICATION_RESPONSE", "Application details could not be verified.");

    const collection = `/v1/control/organizations/${input.organizationId}/applications/${input.applicationId}/webhooks`;
    const sandboxPath = action === "deliveries" ? `${collection}/deliveries`
      : action === "list" || action === "create" ? collection
      : action === "update" || action === "delete" ? `${collection}/${input.webhookId}`
      : action === "test" ? `${collection}/${input.webhookId}/test`
      : `${collection}/${input.webhookId}/deliveries/${input.deliveryId}/retry`;
    const sandboxUrl = new URL(sandboxPath, sandboxBase);
    const method = action === "list" || action === "deliveries" ? "GET" : action === "create" || action === "test" || action === "retry" ? "POST" : action === "update" ? "PATCH" : "DELETE";
    const forwardedBody = action === "create" ? JSON.stringify({ applicationName: access.applicationName, url: body["url"], description: body["description"], events: body["events"] })
      : action === "update" ? JSON.stringify({ url: body["url"], description: body["description"], events: body["events"], active: body["active"] })
      : undefined;
    const sandboxResponse = await fetch(sandboxUrl, {
      method,
      headers: { accept: "application/json", authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": access.actorAccountId, ...(forwardedBody ? { "content-type": "application/json" } : {}) },
      ...(forwardedBody ? { body: forwardedBody } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    if (sandboxResponse.headers.get("content-type")?.startsWith("application/json")) headers.set("content-type", "application/json; charset=utf-8");
    return new NextResponse(sandboxResponse.status === 204 ? null : await sandboxResponse.arrayBuffer(), { status: sandboxResponse.status, headers });
  } catch {
    return jsonError(502, "WEBHOOK_SERVICE_UNAVAILABLE", "Webhook management could not be completed. Try again shortly.");
  }
}

function isRead(action: WebhookAction): boolean {
  return action === "list" || action === "deliveries";
}
