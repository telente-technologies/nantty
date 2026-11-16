import { NextResponse, type NextRequest } from "next/server";

import { readDeveloperDocsUrl } from "@/config/site.config";

export function GET(request: NextRequest) {
  const docsOrigin = process.env.NODE_ENV === "production"
    ? readDeveloperDocsUrl()
    : request.nextUrl.origin;
  const pages = ["/", "/business-messaging", "/openapi.json"];
  const urls = pages.map((path) => `  <url><loc>${new URL(path, docsOrigin)}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
