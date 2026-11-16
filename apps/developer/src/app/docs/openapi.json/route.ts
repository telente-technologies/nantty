import { NextResponse } from "next/server";

import { buildBusinessMessagingOpenApiSpec } from "@/lib/businessMessagingOpenApi";

export function GET() {
  return NextResponse.json(buildBusinessMessagingOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
