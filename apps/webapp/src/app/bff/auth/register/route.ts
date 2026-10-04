import { NextResponse, type NextRequest } from "next/server";

import { callAuthEndpoint, beginSessionWithAuthResult } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { isRequestFromWebappOrigin } from "@/server/requestOriginGuard.service";

interface RegisterBody {
  readonly email?: unknown;
  readonly username?: unknown;
  readonly password?: unknown;
  readonly birthday?: unknown;
  readonly name?: unknown;
  readonly otpToken?: unknown;
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  if (!isRequestFromWebappOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  if (!body) return respondWithBffError(400, "VALIDATION_FAILED", "Fill in every required field.");

  const password = typeof body.password === "string" ? body.password : "";
  const birthday = typeof body.birthday === "string" ? body.birthday : "";
  const otpToken = typeof body.otpToken === "string" ? body.otpToken : "";
  const email = readOptionalString(body.email, 254);
  const username = readOptionalString(body.username, 30);
  const name = readOptionalString(body.name, 80);

  if (!email) return respondWithBffError(400, "VALIDATION_FAILED", "Enter the email you signed up with.");
  if (password.length < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(birthday) || otpToken.length < 20) {
    return respondWithBffError(400, "VALIDATION_FAILED", "Check your birthday, password and verification code.");
  }

  const result = await callAuthEndpoint("/api/v1/auth/register", {
    email,
    ...(username ? { username } : {}),
    ...(name ? { name } : {}),
    password,
    birthday,
    otpToken,
  });
  if (!result.session) return respondWithBffError(result.status, result.error?.code ?? "REGISTRATION_FAILED", result.error?.message ?? "We could not create your account.", result.error?.suggestions);
  const response = NextResponse.json({ user: result.session.user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  beginSessionWithAuthResult(response, result.session);
  return response;
}
