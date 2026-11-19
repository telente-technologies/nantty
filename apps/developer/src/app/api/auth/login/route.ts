import { NextRequest } from "next/server";

import { startSsoLogin } from "@/server/developerSso";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return startSsoLogin(request);
}
