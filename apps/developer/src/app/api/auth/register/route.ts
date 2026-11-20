import type { NextRequest } from "next/server";

import { forwardDeveloperRegisterRequest } from "@/server/developerAuthProxy";

export async function POST(request: NextRequest) {
  return forwardDeveloperRegisterRequest(request);
}
