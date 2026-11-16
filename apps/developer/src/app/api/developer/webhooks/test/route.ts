import type { NextRequest } from "next/server";

import { forwardDeveloperWebhookRequest } from "@/server/developerWebhooksProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: NextRequest) { return forwardDeveloperWebhookRequest(request, "test"); }
