import type { NextRequest } from "next/server";

import { forwardDeveloperOrganizationRequest } from "@/server/developerOrganizationsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
