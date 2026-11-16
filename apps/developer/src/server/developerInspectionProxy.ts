import { NextRequest, NextResponse } from "next/server";

const accountAccessCookie = "__Host-zd_at";
const localAccessCookie = "zd_webapp_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InspectionKind = "requests" | "usage";

interface EffectiveApplicationCapabilities {
  readonly actorAccountId: string;
  readonly organizationId: string;
  readonly applicationId: string;
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

export async function forwardDeveloperInspectionRequest(request: NextRequest, kind: InspectionKind): Promise<NextResponse> {
  const identityBase = safeBaseUrl(process.env.DEVELOPER_API_BASE_URL, false);
  const sandboxBase = safeBaseUrl(process.env.SANDBOX_API_BASE_URL, true);
  const controlToken = process.env.SANDBOX_CONTROL_TOKEN?.trim();
  if (!identityBase) return jsonError(503, "DEVELOPER_API_NOT_CONFIGURED", "The Nantty API gateway is not configured for this portal.");
  if (!sandboxBase || !controlToken || controlToken.length < 32) {
    return jsonError(503, "SANDBOX_INSPECTION_NOT_CONFIGURED", "Sandbox inspection is not connected.");
  }

  const accessToken = request.cookies.get(process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie)?.value;
  if (!accessToken) {
    return jsonError(
      process.env.NODE_ENV === "production" ? 503 : 401,
      process.env.NODE_ENV === "production" ? "PORTAL_SSO_NOT_CONFIGURED" : "UNAUTHENTICATED",
      process.env.NODE_ENV === "production"
        ? "Centralized Nantty sign-in is not connected to this portal yet."
        : "Sign in to Nantty to view sandbox diagnostics.",
    );
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
  const applicationId = request.nextUrl.searchParams.get("applicationId") ?? "";
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(applicationId)) {
    return jsonError(400, "INVALID_APPLICATION", "Choose a valid organization and application.");
  }

  const requiredCapability = kind === "requests" ? "request_logs.read" : "usage.read";
  const identityUrl = new URL(`/api/v1/developer/organizations/${organizationId}/applications/${applicationId}/capabilities/me`, identityBase);
  try {
    const identityResponse = await fetch(identityUrl, {
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (identityResponse.status === 401) return jsonError(401, "UNAUTHENTICATED", "Your Nantty session has expired. Sign in again.");
    if (identityResponse.status === 403) return jsonError(403, "FORBIDDEN", "You do not have permission to view this application.");
    if (identityResponse.status === 404) return jsonError(404, "APPLICATION_NOT_FOUND", "This application is not available to your organization.");
    if (!identityResponse.ok) return jsonError(502, "IDENTITY_UNAVAILABLE", "Application permissions could not be confirmed.");

    const access = await identityResponse.json() as EffectiveApplicationCapabilities;
    if (!uuidPattern.test(access.actorAccountId) || access.organizationId !== organizationId || access.applicationId !== applicationId) {
      return jsonError(403, "RESOURCE_MISMATCH", "Application access could not be confirmed.");
    }
    if (!access.capabilities.includes(requiredCapability)) {
      return jsonError(403, "FORBIDDEN", `You need the ${requiredCapability} grant on this application.`);
    }

    const sandboxUrl = new URL(`/v1/control/organizations/${organizationId}/applications/${applicationId}/${kind}`, sandboxBase);
    const sandboxResponse = await fetch(sandboxUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${controlToken}`,
        "x-nantty-actor-account-id": access.actorAccountId,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    if (sandboxResponse.headers.get("content-type")?.startsWith("application/json")) {
      headers.set("content-type", "application/json; charset=utf-8");
    }
    return new NextResponse(await sandboxResponse.arrayBuffer(), { status: sandboxResponse.status, headers });
  } catch {
    return jsonError(502, "SANDBOX_INSPECTION_UNAVAILABLE", "Sandbox diagnostics could not be loaded. Try again shortly.");
  }
}
