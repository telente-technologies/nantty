import type { NextRequest } from "next/server";

import { forwardDeveloperCredentialRequest } from "@/server/developerCredentialsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) { return forwardDeveloperCredentialRequest(request, "list"); }
export function POST(request: NextRequest) { return forwardDeveloperCredentialRequest(request, "issue"); }
export function DELETE(request: NextRequest) { return forwardDeveloperCredentialRequest(request, "revoke"); }
