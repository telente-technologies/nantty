import { NextRequest, NextResponse } from "next/server";

const maxBodyBytes = 16 * 1024;
const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const organizationBasePath = "/api/v1/developer/organizations";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type DeveloperOrganizationsRouteContext = { readonly params: Promise<{ readonly path?: string[] }> };

function readApiBaseUrl(): URL | null {
  const configured = process.env.DEVELOPER_API_BASE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHost && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function routeIsAllowed(method: string, path: readonly string[]): boolean {
  if (path.length === 0) return method === "GET" || method === "POST";
  const organizationId = path[0];
  if (!organizationId || !uuidPattern.test(organizationId)) return false;
  if (path.length === 1) return method === "GET";
  const resource = path[1];
  if (path.length === 2 && resource && ["access", "roles", "members"].includes(resource)) return method === "GET";
  const memberId = path[2];
  return path.length === 3 && resource === "members" && memberId !== undefined && uuidPattern.test(memberId) && ["GET", "PATCH", "DELETE"].includes(method);
}

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function forwardDeveloperOrganizationRequest(request: NextRequest, context: DeveloperOrganizationsRouteContext): Promise<NextResponse> {
  const { path = [] } = await context.params;
  if (!routeIsAllowed(request.method, path)) return jsonError(404, "NOT_FOUND", "This organization endpoint is not available.");
  const baseUrl = readApiBaseUrl();
  if (!baseUrl) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "The Nantty API gateway is not configured for this portal.");

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) return jsonError(401, "UNAUTHENTICATED", "Sign in to Nantty to manage an organization.");

  const mutating = !["GET", "HEAD"].includes(request.method);
  if (mutating && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) {
    return jsonError(403, "CSRF_REJECTED", "This organization request could not be verified. Reload the page and try again.");
  }

  let body: string | undefined;
  if (mutating && request.method !== "DELETE") {
    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (declaredBytes > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    if (rawBody) {
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Send organization changes as JSON.");
      try { JSON.parse(rawBody); } catch { return jsonError(400, "INVALID_JSON", "The request body must be valid JSON."); }
      body = rawBody;
    }
  }

  const upstreamUrl = new URL(`${organizationBasePath}${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, baseUrl);
  const headers = new Headers({ accept: "application/json", authorization: `Bearer ${accessToken}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (request.method === "POST" && path.length === 0 && idempotencyKey && /^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) headers.set("idempotency-key", idempotencyKey);

  try {
    const upstream = await fetch(upstreamUrl, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const responseHeaders = new Headers({ "Cache-Control": "no-store, max-age=0" });
    for (const name of ["content-type", "x-request-id", "idempotent-replayed"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "DEVELOPER_API_UNAVAILABLE", "The organization service could not be reached. Try again shortly.");
  }
}
