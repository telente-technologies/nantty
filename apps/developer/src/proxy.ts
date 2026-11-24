import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DOCS_HOST = "docs.nantty.com";
const isDevelopmentBuild = process.env.NODE_ENV === "development";

function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopmentBuild ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${isDevelopmentBuild ? " http:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${isDevelopmentBuild ? " http://localhost:* http://127.0.0.1:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Serve the public documentation from its own host without a second app deployment. */
export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const hostname = request.headers.get("host")?.split(":", 1)[0]?.toLowerCase();
  let response: NextResponse;
  if (hostname !== DOCS_HOST) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/brand/") || pathname === "/favicon.ico") {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  }

  const destination = request.nextUrl.clone();
  if (pathname === "/") {
    destination.pathname = "/docs";
  } else if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/openapi.json") {
    destination.pathname = `/docs${pathname}`;
  } else if (pathname !== "/docs" && !pathname.startsWith("/docs/")) {
    destination.pathname = `/docs${pathname}`;
  }

  response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
