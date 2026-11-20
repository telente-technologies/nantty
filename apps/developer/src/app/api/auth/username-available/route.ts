import type { NextRequest } from "next/server";

import { forwardDeveloperUsernameAvailabilityRequest } from "@/server/developerAuthProxy";

export async function GET(request: NextRequest) {
  return forwardDeveloperUsernameAvailabilityRequest(request);
}
