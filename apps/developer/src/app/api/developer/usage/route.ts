import type { NextRequest } from "next/server";

import { forwardDeveloperInspectionRequest } from "@/server/developerInspectionProxy";

export async function GET(request: NextRequest) {
  return forwardDeveloperInspectionRequest(request, "usage");
}
