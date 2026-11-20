import { NextRequest } from "next/server";

import { forwardDeveloperLogoutRequest } from "@/server/developerAuthProxy";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return forwardDeveloperLogoutRequest(request);
}
