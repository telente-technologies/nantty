import { NextRequest, NextResponse } from "next/server";

const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBodyBytes = 4 * 1024;

type CredentialAction = "list" | "issue" | "revoke" | "rotate";

interface CredentialRequest {
  readonly organizationId: string;
  readonly applicationId: string;
  readonly credentialId?: string;
  readonly expiresAt?: string | null;
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

function readInput(request: NextRequest, action: CredentialAction): CredentialRequest | null {
  if (action === "list") {
    return { organizationId: request.nextUrl.searchParams.get("organizationId") ?? "", applicationId: request.nextUrl.searchParams.get("applicationId") ?? "" };
  }
  return null;
}

export async function forwardDeveloperCredentialRequest(request: NextRequest, action: CredentialAction): Promise<NextResponse> {
  const identityBase = safeBaseUrl(process.env.DEVELOPER_API_BASE_URL, false);
  const sandboxBase = safeBaseUrl(process.env.SANDBOX_API_BASE_URL, true);
  const controlToken = process.env.SANDBOX_CONTROL_TOKEN?.trim();
  if (!identityBase) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "Credential management is temporarily unavailable. Try again shortly.");
  if (!sandboxBase || !controlToken || controlToken.length < 32) return jsonError(503, "SANDBOX_CREDENTIALS_NOT_CONFIGURED", "Sandbox credential management is temporarily unavailable. Try again shortly.");

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) return jsonError(process.env.NODE_ENV === "production" ? 503 : 401, process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED", process.env.NODE_ENV === "production" ? "Sign-in is temporarily unavailable. Try again shortly." : "Sign in to Nantty to manage credentials.");
  if (action !== "list" && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return jsonError(403, "CSRF_REJECTED", "This credential request could not be verified. Reload the page and try again.");

  let input = readInput(request, action);
  if (action !== "list") {
    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (declaredBytes > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send credential changes as JSON.");
    try { input = JSON.parse(rawBody) as CredentialRequest; } catch { return jsonError(400, "INVALID_JSON", "The request body must be valid JSON."); }
  }
  if (!input || !uuidPattern.test(input.organizationId) || !uuidPattern.test(input.applicationId)) return jsonError(400, "INVALID_APPLICATION", "Choose a valid organization and application.");
  if ((action === "revoke" || action === "rotate") && (!input.credentialId || !uuidPattern.test(input.credentialId))) return jsonError(400, "INVALID_CREDENTIAL", "Choose a valid credential.");
  if (input.expiresAt !== undefined && input.expiresAt !== null && (typeof input.expiresAt !== "string" || !Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now() + 60_000)) return jsonError(400, "INVALID_EXPIRY", "Choose a future expiration time or leave expiration unset.");

  const identityUrl = new URL(`/api/v1/developer/organizations/${input.organizationId}/applications/${input.applicationId}/capabilities/me`, identityBase);
  try {
    const identityResponse = await fetch(identityUrl, { headers: { accept: "application/json", authorization: `Bearer ${accessToken}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    if (identityResponse.status === 401) return jsonError(401, "UNAUTHENTICATED", "Your Nantty session has expired. Sign in again.");
    if (identityResponse.status === 403) return jsonError(403, "FORBIDDEN", "You do not have permission to manage credentials for this application.");
    if (identityResponse.status === 404) return jsonError(404, "APPLICATION_NOT_FOUND", "This application is not available to your organization.");
    if (!identityResponse.ok) return jsonError(502, "IDENTITY_UNAVAILABLE", "Application permissions could not be confirmed.");
    const access = await identityResponse.json() as EffectiveApplicationCapabilities;
    if (!uuidPattern.test(access.actorAccountId) || access.organizationId !== input.organizationId || access.applicationId !== input.applicationId) return jsonError(403, "RESOURCE_MISMATCH", "Application access could not be confirmed.");
    if (!access.capabilities.includes("credentials.manage")) return jsonError(403, "FORBIDDEN", "You do not have permission to manage credentials for this application.");
    if (action === "issue" && (!access.applicationName || access.applicationName.length > 120)) return jsonError(502, "INVALID_APPLICATION_RESPONSE", "Application details could not be verified.");

    const sandboxPath = `/v1/control/organizations/${input.organizationId}/applications/${input.applicationId}/credentials`;
    const sandboxUrl = new URL(action === "rotate" ? `${sandboxPath}/${input.credentialId}/rotate` : action === "revoke" ? `${sandboxPath}/${input.credentialId}` : sandboxPath, sandboxBase);
    const method = action === "list" ? "GET" : action === "revoke" ? "DELETE" : "POST";
    const body = action === "issue" ? JSON.stringify({ name: access.applicationName, expiresAt: input.expiresAt ?? null }) : action === "rotate" ? JSON.stringify({ expiresAt: input.expiresAt ?? null }) : undefined;
    const sandboxResponse = await fetch(sandboxUrl, { method, headers: { accept: "application/json", authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": access.actorAccountId, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    if (sandboxResponse.headers.get("content-type")?.startsWith("application/json")) headers.set("content-type", "application/json; charset=utf-8");
    return new NextResponse(sandboxResponse.status === 204 ? null : await sandboxResponse.arrayBuffer(), { status: sandboxResponse.status, headers });
  } catch {
    return jsonError(502, "CREDENTIAL_SERVICE_UNAVAILABLE", "Credential management could not be completed. Try again shortly.");
  }
}
