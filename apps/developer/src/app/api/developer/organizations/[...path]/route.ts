import type { NextRequest } from "next/server";

import { forwardDeveloperOrganizationRequest } from "@/server/developerOrganizationsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
export function POST(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
export function PATCH(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
export function PUT(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
export function DELETE(request: NextRequest) { return forwardDeveloperOrganizationRequest(request); }
