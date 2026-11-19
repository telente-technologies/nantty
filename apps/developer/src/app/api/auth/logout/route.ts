import { NextRequest, NextResponse } from "next/server";

import { accessCookieName } from "@/server/developerSso";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ code: "CSRF_REJECTED", message: "Origin mismatch." }, { status: 403 });
  }
  const response = NextResponse.json({ signedOut: true }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } });
  response.cookies.delete(accessCookieName());
  return response;
}
