import { NextResponse, type NextRequest } from "next/server";

import { isMockBackendEnabled } from "@/config/studioEnvironment.config";
import { beginSessionWithAuthResult, callAuthEndpoint } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { isRequestFromStudioOrigin } from "@/server/requestOriginGuard.service";

type SocialProvider = "apple" | "google";

const providerDisplayNames: Record<SocialProvider, string> = { apple: "Apple", google: "Google" };

interface SocialSignInBody {
  readonly provider?: unknown;
  readonly idToken?: unknown;
  readonly nonce?: unknown;
  readonly fullName?: { readonly givenName?: string | null; readonly familyName?: string | null } | null;
}

function readClientIdForProvider(provider: SocialProvider): string {
  return (provider === "google" ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID : process.env.NEXT_PUBLIC_APPLE_CLIENT_ID) ?? "";
}

function buildDemoIdentityToken(provider: SocialProvider): string {
  const encodeSegment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);
  return [encodeSegment({ alg: "none", typ: "JWT" }), encodeSegment({ sub: `zudomart-demo-${provider}`, aud: provider, iat: issuedAt, exp: issuedAt + 900 }), encodeSegment({ demo: true })].join(".");
}

export async function POST(request: NextRequest) {
  if (!isRequestFromStudioOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This sign-in request could not be verified.");

  const body = (await request.json().catch(() => null)) as SocialSignInBody | null;
  const provider: SocialProvider | null = body?.provider === "apple" || body?.provider === "google" ? body.provider : null;
  if (!provider) return respondWithBffError(400, "VALIDATION_FAILED", "Choose Google or Apple to continue.");

  const suppliedIdToken = typeof body?.idToken === "string" && body.idToken.length > 0 ? body.idToken : null;
  const demoToken = suppliedIdToken ?? (isMockBackendEnabled() ? buildDemoIdentityToken(provider) : null);

  if (!demoToken && !readClientIdForProvider(provider)) {
    return respondWithBffError(501, "SOCIAL_SIGN_IN_NOT_CONFIGURED", `${providerDisplayNames[provider]} sign-in isn't configured yet.`);
  }

  const nonce = typeof body?.nonce === "string" ? body.nonce : undefined;
  const fullName = provider === "apple" ? (body?.fullName ?? undefined) : undefined;
  const exchangeBody = provider === "google" ? { idToken: demoToken ?? suppliedIdToken, nonce } : { identityToken: demoToken ?? suppliedIdToken, nonce, fullName };

  const result = await callAuthEndpoint(provider === "google" ? "/api/v1/auth/google" : "/api/v1/auth/apple", exchangeBody);
  if (!result.session) return respondWithBffError(result.status, result.error?.code ?? "SOCIAL_SIGN_IN_FAILED", result.error?.message ?? `${providerDisplayNames[provider]} sign-in failed. Try again.`);

  const response = NextResponse.json({ user: result.session.user }, { headers: { "Cache-Control": "no-store" } });
  beginSessionWithAuthResult(response, result.session);
  return response;
}
