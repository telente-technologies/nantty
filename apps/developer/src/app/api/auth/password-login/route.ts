import type { NextRequest } from "next/server";

import { forwardDeveloperPasswordLoginRequest } from "@/server/developerAuthProxy";

export async function POST(request: NextRequest) {
  return forwardDeveloperPasswordLoginRequest(request);
}
