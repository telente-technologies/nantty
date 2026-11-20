import type { NextRequest } from "next/server";

import { forwardDeveloperOtpSendRequest } from "@/server/developerOrganizationsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return forwardDeveloperOtpSendRequest(request);
}
