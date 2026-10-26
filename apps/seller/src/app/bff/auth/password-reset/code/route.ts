import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { normaliseResetEmailAddress } from "@/server/passwordReset.service";
import { isRequestFromDashboardOrigin } from "@/server/requestOriginGuard.service";
import { callSellerBackend, encodeJsonRequestBody } from "@/server/sellerApiTransport.service";

export async function POST(request: NextRequest) {
  if (!isRequestFromDashboardOrigin(request)) return respondWithBffError(403, "CSRF_REJECTED", "This request could not be verified.");
  const body = (await request.json().catch(() => null)) as { destination?: unknown } | null;
  const destination = normaliseResetEmailAddress(body?.destination);
  if (!destination) return respondWithBffError(400, "VALIDATION_FAILED", "Enter the email address on your Nantty account.");
  const result = await callSellerBackend({ method: "POST", path: "/auth/otp/send", body: encodeJsonRequestBody({ destination, purpose: "reset" }), contentType: "application/json" });
  if (result.status === 429) return respondWithBffError(429, "TOO_MANY_REQUESTS", "Too many codes requested. Wait a few minutes and try again.");
  return NextResponse.json({ sent: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
