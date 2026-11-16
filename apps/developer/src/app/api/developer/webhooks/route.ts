import type { NextRequest } from "next/server";

import { forwardDeveloperWebhookRequest } from "@/server/developerWebhooksProxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) { return forwardDeveloperWebhookRequest(request, "list"); }
export function POST(request: NextRequest) { return forwardDeveloperWebhookRequest(request, "create"); }
export function PATCH(request: NextRequest) { return forwardDeveloperWebhookRequest(request, "update"); }
export function DELETE(request: NextRequest) { return forwardDeveloperWebhookRequest(request, "delete"); }
