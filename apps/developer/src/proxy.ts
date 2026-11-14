import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DOCS_HOST = "docs.nantty.com";

/** Serve the public documentation from its own host without a second app deployment. */
export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":", 1)[0]?.toLowerCase();
  if (hostname !== DOCS_HOST) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/brand/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  if (pathname === "/") {
    destination.pathname = "/docs";
  } else if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    destination.pathname = `/docs${pathname}`;
  } else if (pathname !== "/docs" && !pathname.startsWith("/docs/")) {
    destination.pathname = `/docs${pathname}`;
  }

  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/:path*",
};
