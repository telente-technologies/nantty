import type { NextRequest } from "next/server";
import { forwardSandboxIdentityGet } from "@/server/sandboxPortalProxy";

export async function GET(request: NextRequest) {
  return forwardSandboxIdentityGet(request, "organizations");
}
