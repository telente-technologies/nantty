import type { NextRequest } from "next/server";

import { forwardBffRequestToWebappApi } from "@/server/gateway.service";

interface BffRouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

async function handleBffRequest(request: NextRequest, context: BffRouteContext) {
  const { path } = await context.params;
  return forwardBffRequestToWebappApi(request, path);
}

export const dynamic = "force-dynamic";
export const GET = handleBffRequest;
export const POST = handleBffRequest;
export const PUT = handleBffRequest;
export const PATCH = handleBffRequest;
export const DELETE = handleBffRequest;
