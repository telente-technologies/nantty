import { NextResponse } from "next/server";

import { buildBusinessMessagingOpenApiSpec } from "@/lib/businessMessagingOpenApi";

export function GET() {
  return NextResponse.json(buildBusinessMessagingOpenApiSpec(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
