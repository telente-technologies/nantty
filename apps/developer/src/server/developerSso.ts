import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const accountAccessCookie = "__Host-zd_at";
export const localAccessCookie = "zd_webapp_at";
const pkceCookie = "zd_sso_pkce";

export interface DeveloperSsoConfig {
  readonly authorizeBaseUrl: string;
  readonly apiBaseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function readDeveloperSsoConfig(): DeveloperSsoConfig | null {
  const apiBaseUrl = process.env.DEVELOPER_API_BASE_URL?.trim();
  const authorizeBaseUrl = process.env.DEVELOPER_SSO_AUTHORIZE_URL?.trim() || apiBaseUrl;
  const clientId = process.env.DEVELOPER_SSO_CLIENT_ID?.trim();
  const clientSecret = process.env.DEVELOPER_SSO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DEVELOPER_SSO_REDIRECT_URI?.trim();
  if (!apiBaseUrl || !authorizeBaseUrl || !clientId || !clientSecret || !redirectUri) {
    return null;
  }
  try {
    const api = new URL(apiBaseUrl);
    const auth = new URL(authorizeBaseUrl);
    const redirect = new URL(redirectUri);
    const isProd = process.env.NODE_ENV === "production";
    if (isProd && (api.protocol !== "https:" || auth.protocol !== "https:" || redirect.protocol !== "https:")) {
      return null;
    }
    return {
      apiBaseUrl: api.origin,
      authorizeBaseUrl: auth.origin,
      clientId,
      clientSecret,
      redirectUri: redirect.toString(),
    };
  } catch {
    return null;
  }
}

export function createPkceChallengePair(): { readonly verifier: string; readonly challenge: string; readonly state: string } {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(24).toString("base64url");
  return { verifier, challenge, state };
}

export function accessCookieName(): string {
  return process.env.NODE_ENV === "production" ? accountAccessCookie : localAccessCookie;
}

export function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  try {
    const base = "https://developer-return.invalid";
    const destination = new URL(raw, base);
    return destination.origin === base ? `${destination.pathname}${destination.search}${destination.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function startSsoLogin(request: NextRequest): NextResponse {
  const config = readDeveloperSsoConfig();
  if (!config) {
    return NextResponse.json(
      { code: "SSO_NOT_CONFIGURED", message: "Sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  const { verifier, challenge, state } = createPkceChallengePair();
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const target = new URL("/api/v1/auth/sso/authorize", config.authorizeBaseUrl);
  target.searchParams.set("client_id", config.clientId);
  target.searchParams.set("redirect_uri", config.redirectUri);
  target.searchParams.set("code_challenge", challenge);
  target.searchParams.set("code_challenge_method", "S256");
  target.searchParams.set("state", state);

  const response = NextResponse.redirect(target.toString(), 302);
  response.cookies.set(pkceCookie, JSON.stringify({ verifier, state, returnTo }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/callback",
    maxAge: 300,
  });
  return response;
}

export async function handleSsoCallback(request: NextRequest): Promise<NextResponse> {
  const config = readDeveloperSsoConfig();
  if (!config) {
    return NextResponse.json(
      { code: "SSO_NOT_CONFIGURED", message: "Sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();
  const rawPkce = request.cookies.get(pkceCookie)?.value;
  if (!code || !state || !rawPkce) {
    return NextResponse.json({ code: "INVALID_SSO_CALLBACK", message: "Missing authorization code or PKCE state." }, { status: 400 });
  }
  let parsedPkce: { verifier?: string; state?: string; returnTo?: string };
  try {
    parsedPkce = JSON.parse(rawPkce) as { verifier?: string; state?: string; returnTo?: string };
  } catch {
    return NextResponse.json({ code: "INVALID_SSO_STATE", message: "Invalid PKCE state cookie." }, { status: 400 });
  }
  if (!parsedPkce.verifier || !parsedPkce.state || parsedPkce.state !== state) {
    return NextResponse.json({ code: "SSO_STATE_MISMATCH", message: "State verification failed." }, { status: 403 });
  }

  const exchangeUrl = new URL("/api/v1/auth/sso/token", config.apiBaseUrl);
  let upstream: Response;
  try {
    upstream = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        redirectUri: config.redirectUri,
        codeVerifier: parsedPkce.verifier,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return NextResponse.json({ code: "SSO_IDENTITY_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { code: "SSO_TOKEN_EXCHANGE_FAILED", message: "Could not complete cross-domain sign-in." },
      { status: upstream.status >= 500 ? 503 : 401 },
    );
  }
  const tokenPayload = (await upstream.json().catch(() => null)) as { accessToken?: string; expiresIn?: number } | null;
  if (!tokenPayload?.accessToken) {
    return NextResponse.json({ code: "SSO_TOKEN_MISSING", message: "Identity server returned no access token." }, { status: 502 });
  }
  const destination = safeReturnPath(parsedPkce.returnTo ?? null);
  const response = NextResponse.redirect(new URL(destination, request.nextUrl.origin), 302);
  response.cookies.delete(pkceCookie);
  response.cookies.set(accessCookieName(), tokenPayload.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: typeof tokenPayload.expiresIn === "number" && Number.isFinite(tokenPayload.expiresIn)
      ? Math.max(1, Math.min(900, Math.floor(tokenPayload.expiresIn)))
      : 900,
  });
  return response;
}
