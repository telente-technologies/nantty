import type { NextRequest } from "next/server";

import { forwardDeveloperOrganizationRequest, type DeveloperOrganizationsRouteContext } from "@/server/developerOrganizationsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest, context: DeveloperOrganizationsRouteContext) { return forwardDeveloperOrganizationRequest(request, context); }
export function POST(request: NextRequest, context: DeveloperOrganizationsRouteContext) { return forwardDeveloperOrganizationRequest(request, context); }
