import { NextRequest, NextResponse } from "next/server";

import { accessCookieName, readDeveloperSsoConfig } from "@/server/developerSso";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const configured = readDeveloperSsoConfig() !== null;
  const authenticated = Boolean(request.cookies.get(accessCookieName())?.value);
  return NextResponse.json(
    { configured, authenticated },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
