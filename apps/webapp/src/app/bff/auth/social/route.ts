import { NextResponse, type NextRequest } from "next/server";

import { shouldUseRealBackend } from "@/config/webappEnvironment.config";
import { beginSessionWithAuthResult, callAuthEndpoint } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { isRequestFromWebappOrigin } from "@/server/requestOriginGuard.service";

type SocialProvider = "apple" | "google";

const providerDisplayNames: Record<SocialProvider, string> = { apple: "Apple", google: "Google" };

interface SocialSignInBody {
  readonly provider?: unknown;
  readonly idToken?: unknown;
  readonly identityToken?: unknown;
  readonly nonce?: unknown;
  readonly birthday?: unknown;
  readonly fullName?: { readonly givenName?: string | null; readonly familyName?: string | null } | null;
}

function buildDemoIdentityToken(provider: SocialProvider): string {
  const encodeSegment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);
  return [encodeSegment({ alg: "none", typ: "JWT" }), encodeSegment({ sub: `nantty-demo-${provider}`, aud: provider, iat: issuedAt, exp: issuedAt + 900 }), encodeSegment({ demo: true })].join(".");
}

function isRealIsoBirthday(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1]!;
}

export async function POST(request: NextRequest) {
  if (!isRequestFromWebappOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This sign-in request could not be verified.");

  const body = (await request.json().catch(() => null)) as SocialSignInBody | null;
  const provider: SocialProvider | null = body?.provider === "apple" || body?.provider === "google" ? body.provider : null;
  if (!provider) return respondWithBffError(400, "VALIDATION_FAILED", "Choose Google or Apple to continue.");

  if (body?.birthday !== undefined && body.birthday !== null && !isRealIsoBirthday(body.birthday)) {
    return respondWithBffError(400, "VALIDATION_FAILED", "Enter a valid birthday to continue.");
  }

  const exchangePath = provider === "google" ? "/api/v1/auth/google" : "/api/v1/auth/apple";
  const suppliedToken = provider === "apple" ? body?.identityToken : body?.idToken;
  const identityToken = typeof suppliedToken === "string" && suppliedToken.length > 0 ? suppliedToken : null;
  const providerToken = identityToken ?? (shouldUseRealBackend(exchangePath) ? null : buildDemoIdentityToken(provider));

  if (!providerToken) {
    return respondWithBffError(501, "SOCIAL_SIGN_IN_NOT_CONFIGURED", `${providerDisplayNames[provider]} sign-in isn't configured yet.`);
  }

  const nonce = typeof body?.nonce === "string" ? body.nonce : undefined;
  const fullName = provider === "apple" ? (body?.fullName ?? undefined) : undefined;
  const birthday = typeof body?.birthday === "string" ? body.birthday : undefined;
  const exchangeBody = provider === "google"
    ? { idToken: providerToken, nonce, ...(birthday ? { birthday } : {}) }
    : { identityToken: providerToken, nonce, fullName, ...(birthday ? { birthday } : {}) };

  const result = await callAuthEndpoint(exchangePath, exchangeBody);
  if (!result.session) return respondWithBffError(result.status, result.error?.code ?? "SOCIAL_SIGN_IN_FAILED", result.error?.message ?? `${providerDisplayNames[provider]} sign-in failed. Try again.`);

  const response = NextResponse.json({ user: result.session.user, notice: result.session.notice ?? null }, { headers: { "Cache-Control": "no-store" } });
  beginSessionWithAuthResult(response, result.session);
  return response;
}
