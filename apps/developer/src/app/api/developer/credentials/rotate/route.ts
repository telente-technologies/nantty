import type { NextRequest } from "next/server";

import { forwardDeveloperCredentialRequest } from "@/server/developerCredentialsProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) { return forwardDeveloperCredentialRequest(request, "rotate"); }
