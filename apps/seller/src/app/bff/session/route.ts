import { NextResponse, type NextRequest } from "next/server";

import { respondWithBffError } from "@/server/bffGateway.service";
import { buildSellerSessionViewFromCookies } from "@/server/sellerSessionView.service";

export async function GET(request: NextRequest) {
  const sessionView = buildSellerSessionViewFromCookies(request.cookies);
  if (!sessionView) return respondWithBffError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
  return NextResponse.json(sessionView, { headers: { "Cache-Control": "no-store" } });
}
