import { NextRequest } from "next/server";

import { handleSsoCallback } from "@/server/developerSso";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleSsoCallback(request);
}
