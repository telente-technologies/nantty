import type { NextRequest } from "next/server";

import { forwardDeveloperOtpVerifyRequest } from "@/server/developerOrganizationsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return forwardDeveloperOtpVerifyRequest(request);
}
