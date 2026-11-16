import { NextRequest, NextResponse } from "next/server";

const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBodyBytes = 16 * 1024;

export type SandboxControlAction =
  | "credentials.list"
  | "credentials.issue"
  | "credentials.rotate"
  | "credentials.revoke"
  | "conversations.list"
  | "conversations.create"
  | "conversations.message"
  | "messages.transition"
  | "scenarios.run"
  | "sandbox.reset"
  | "webhooks.list"
  | "webhooks.deliveries"
  | "webhooks.test"
  | "webhooks.retry"
  | "requests.list"
  | "usage.read";

interface EffectiveCapabilities {
  readonly actorAccountId: string;
  readonly organizationId: string;
  readonly applicationId: string;
  readonly applicationName: string;
  readonly capabilities: readonly string[];
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export function safeBaseUrl(value: string | undefined, sandbox: boolean): URL | null {
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

export function readPortalToken(request: NextRequest): string | null {
  return request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value ?? null;
}

export function verifyCsrf(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function readJsonBody(request: NextRequest): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON payloads.") };
  }
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > maxBodyBytes) return { ok: false, response: jsonError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.") };
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    return { ok: false, response: jsonError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.") };
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, response: jsonError(400, "INVALID_JSON", "The request body must be a JSON object.") };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError(400, "INVALID_JSON", "The request body must be valid JSON.") };
  }
}

export async function forwardSandboxIdentityGet(request: NextRequest, suffix: string): Promise<NextResponse> {
  const identityBase = safeBaseUrl(process.env.DEVELOPER_API_BASE_URL, false);
  if (!identityBase) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "Identity gateway is not configured for this sandbox portal.");
  const token = readPortalToken(request);
  if (!token) {
    return jsonError(
      process.env.NODE_ENV === "production" ? 503 : 401,
      process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED",
      process.env.NODE_ENV === "production" ? "Centralized Nantty sign-in is not connected to this portal." : "Sign in to Nantty to load your organizations.",
    );
  }
  try {
    const response = await fetch(new URL(`/api/v1/developer/${suffix}`, identityBase), {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    if (response.headers.get("content-type")?.startsWith("application/json")) headers.set("content-type", "application/json; charset=utf-8");
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers });
  } catch {
    return jsonError(502, "IDENTITY_UNAVAILABLE", "Could not reach Identity service.");
  }
}

function requiredCapabilities(action: SandboxControlAction): readonly string[] {
  if (action.startsWith("credentials.")) return ["credentials.manage"];
  if (action.startsWith("webhooks.")) return ["webhooks.manage"];
  if (action === "requests.list") return ["request_logs.read"];
  if (action === "usage.read") return ["usage.read"];
  if (action === "conversations.list") return ["applications.read", "credentials.manage"];
  return ["credentials.manage"];
}

export async function forwardSandboxControl(request: NextRequest, action: SandboxControlAction): Promise<NextResponse> {
  const identityBase = safeBaseUrl(process.env.DEVELOPER_API_BASE_URL, false);
  const sandboxBase = safeBaseUrl(process.env.SANDBOX_API_BASE_URL, true);
  const controlToken = process.env.SANDBOX_CONTROL_TOKEN?.trim();
  if (!identityBase) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "Identity gateway is not configured.");
  if (!sandboxBase || !controlToken || controlToken.length < 32) {
    return jsonError(503, "SANDBOX_CONTROL_NOT_CONFIGURED", "Sandbox control plane is not connected.");
  }
  const accessToken = readPortalToken(request);
  if (!accessToken) {
    return jsonError(
      process.env.NODE_ENV === "production" ? 503 : 401,
      process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED",
      process.env.NODE_ENV === "production" ? "Centralized Nantty sign-in is not connected to this portal." : "Sign in to Nantty to use Sandbox controls.",
    );
  }

  const isRead = action.endsWith(".list") || action === "webhooks.deliveries" || action === "usage.read";
  if (!isRead && !verifyCsrf(request)) return jsonError(403, "CSRF_REJECTED", "Request origin could not be verified.");

  let body: Record<string, unknown> = {};
  if (isRead) {
    body = {
      organizationId: request.nextUrl.searchParams.get("organizationId") ?? "",
      applicationId: request.nextUrl.searchParams.get("applicationId") ?? "",
    };
  } else {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    body = parsed.data;
  }

  const orgId = typeof body["organizationId"] === "string" ? body["organizationId"] : "";
  const appId = typeof body["applicationId"] === "string" ? body["applicationId"] : "";
  if (!uuidPattern.test(orgId) || !uuidPattern.test(appId)) {
    return jsonError(400, "INVALID_APPLICATION", "Choose a valid organization and application.");
  }

  const identityUrl = new URL(`/api/v1/developer/organizations/${orgId}/applications/${appId}/capabilities/me`, identityBase);
  try {
    const identityRes = await fetch(identityUrl, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (identityRes.status === 401) return jsonError(401, "UNAUTHENTICATED", "Your Nantty session has expired. Sign in again.");
    if (identityRes.status === 403) return jsonError(403, "FORBIDDEN", "You do not have permission for this application.");
    if (identityRes.status === 404) return jsonError(404, "APPLICATION_NOT_FOUND", "This application is not available.");
    if (!identityRes.ok) return jsonError(502, "IDENTITY_UNAVAILABLE", "Application permissions could not be confirmed.");

    const access = await identityRes.json() as EffectiveCapabilities;
    if (!uuidPattern.test(access.actorAccountId) || access.organizationId !== orgId || access.applicationId !== appId) {
      return jsonError(403, "RESOURCE_MISMATCH", "Application access could not be confirmed.");
    }
    const allowed = requiredCapabilities(action);
    if (!allowed.some((cap) => access.capabilities.includes(cap))) {
      return jsonError(403, "FORBIDDEN", `Missing required application grant (${allowed.join(" or ")}).`);
    }

    const prefix = `/v1/control/organizations/${orgId}/applications/${appId}`;
    let path = "";
    let method = "GET";
    let forwardBody: string | undefined;

    if (action === "credentials.list") path = `${prefix}/credentials`;
    else if (action === "credentials.issue") {
      path = `${prefix}/credentials`; method = "POST";
      forwardBody = JSON.stringify({ name: access.applicationName || "Sandbox app", expiresAt: body["expiresAt"] ?? null });
    } else if (action === "credentials.rotate") {
      const credId = String(body["credentialId"] ?? "");
      if (!uuidPattern.test(credId)) return jsonError(400, "INVALID_CREDENTIAL", "Choose a valid credential.");
      path = `${prefix}/credentials/${credId}/rotate`; method = "POST";
      forwardBody = JSON.stringify({ expiresAt: body["expiresAt"] ?? null });
    } else if (action === "credentials.revoke") {
      const credId = String(body["credentialId"] ?? "");
      if (!uuidPattern.test(credId)) return jsonError(400, "INVALID_CREDENTIAL", "Choose a valid credential.");
      path = `${prefix}/credentials/${credId}`; method = "DELETE";
    } else if (action === "conversations.list") path = `${prefix}/conversations`;
    else if (action === "conversations.create") {
      path = `${prefix}/conversations`; method = "POST";
      forwardBody = JSON.stringify({ applicationName: access.applicationName || "Sandbox app", customerName: body["customerName"] });
    } else if (action === "conversations.message") {
      const convId = String(body["conversationId"] ?? "");
      if (!uuidPattern.test(convId)) return jsonError(400, "INVALID_CONVERSATION", "Choose a valid conversation.");
      path = `${prefix}/conversations/${convId}/messages`; method = "POST";
      forwardBody = JSON.stringify({ sender: body["sender"], text: body["text"] });
    } else if (action === "messages.transition") {
      const msgId = String(body["messageId"] ?? "");
      if (!uuidPattern.test(msgId)) return jsonError(400, "INVALID_MESSAGE", "Choose a valid message.");
      path = `${prefix}/messages/${msgId}/transition`; method = "POST";
      forwardBody = JSON.stringify({ status: body["status"] });
    } else if (action === "scenarios.run") {
      path = `${prefix}/scenarios/run`; method = "POST";
      forwardBody = JSON.stringify({ scenario: body["scenario"], applicationName: access.applicationName || "Sandbox app" });
    } else if (action === "sandbox.reset") {
      path = `${prefix}/reset`; method = "POST"; forwardBody = "{}";
    } else if (action === "webhooks.list") path = `${prefix}/webhooks`;
    else if (action === "webhooks.deliveries") path = `${prefix}/webhooks/deliveries`;
    else if (action === "webhooks.test") {
      const whId = String(body["webhookId"] ?? "");
      if (!uuidPattern.test(whId)) return jsonError(400, "INVALID_WEBHOOK", "Choose a valid webhook.");
      path = `${prefix}/webhooks/${whId}/test`; method = "POST";
    } else if (action === "webhooks.retry") {
      const whId = String(body["webhookId"] ?? "");
      const delId = String(body["deliveryId"] ?? "");
      if (!uuidPattern.test(whId) || !uuidPattern.test(delId)) return jsonError(400, "INVALID_DELIVERY", "Choose a valid webhook delivery.");
      path = `${prefix}/webhooks/${whId}/deliveries/${delId}/retry`; method = "POST";
    } else if (action === "requests.list") path = `${prefix}/requests`;
    else if (action === "usage.read") path = `${prefix}/usage`;

    const sandboxResponse = await fetch(new URL(path, sandboxBase), {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${controlToken}`,
        "x-nantty-actor-account-id": access.actorAccountId,
        ...(forwardBody ? { "content-type": "application/json" } : {}),
      },
      ...(forwardBody ? { body: forwardBody } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    if (sandboxResponse.headers.get("content-type")?.startsWith("application/json")) headers.set("content-type", "application/json; charset=utf-8");
    return new NextResponse(sandboxResponse.status === 204 ? null : await sandboxResponse.arrayBuffer(), { status: sandboxResponse.status, headers });
  } catch {
    return jsonError(502, "SANDBOX_SERVICE_UNAVAILABLE", "Sandbox control service could not be reached.");
  }
}
