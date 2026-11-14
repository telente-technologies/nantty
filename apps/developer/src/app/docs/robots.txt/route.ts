import { NextResponse, type NextRequest } from "next/server";

import { readDeveloperDocsUrl } from "@/config/site.config";

export function GET(request: NextRequest) {
  const sitemapUrl = new URL("/sitemap.xml", readDeveloperDocsUrl());
  // Use the request origin for local preview, where docs share the developer host.
  if (process.env.NODE_ENV !== "production") sitemapUrl.host = request.nextUrl.host;

  return new NextResponse(`User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
