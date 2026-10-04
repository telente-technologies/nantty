import { NextResponse, type NextRequest } from "next/server";

import { callAuthEndpoint, beginSessionWithAuthResult } from "@/server/authentication.service";
import { respondWithBffError } from "@/server/gateway.service";
import { isRequestFromWebappOrigin } from "@/server/requestOriginGuard.service";

export async function POST(request: NextRequest) {
  if (!isRequestFromWebappOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This sign-in request could not be verified.");
  const body = (await request.json().catch(() => null)) as { identifier?: unknown; password?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (identifier.length < 3 || identifier.length > 254 || password.length < 1 || password.length > 128) {
    return respondWithBffError(400, "VALIDATION_FAILED", "Enter your email or username and your password.");
  }
  const result = await callAuthEndpoint("/api/v1/auth/login", { identifier, password });
  if (!result.session) return respondWithBffError(result.status, result.error?.code ?? "INVALID_CREDENTIALS", result.error?.message ?? "That sign-in details are not right.");
  const response = NextResponse.json({ user: result.session.user, notice: result.session.notice ?? null }, { headers: { "Cache-Control": "no-store" } });
  beginSessionWithAuthResult(response, result.session);
  return response;
}
