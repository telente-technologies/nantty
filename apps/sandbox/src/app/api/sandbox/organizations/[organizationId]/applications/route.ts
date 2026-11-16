import type { NextRequest } from "next/server";
import { forwardSandboxIdentityGet, jsonError } from "@/server/sandboxPortalProxy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { readonly params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  if (!uuidPattern.test(organizationId)) return jsonError(400, "INVALID_ORGANIZATION", "Choose a valid organization.");
  return forwardSandboxIdentityGet(request, `organizations/${organizationId}/applications`);
}
