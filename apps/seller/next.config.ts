import type { NextConfig } from "next";

const isDevelopmentBuild = process.env.NODE_ENV === "development";

function readOriginOrEmpty(configuredUrl: string | undefined): string {
  if (!configuredUrl) return "";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "";
  }
}

function buildContentSecurityPolicyHeaderValue(): string {
  const mediaOrigin = readOriginOrEmpty(process.env.SELLER_MEDIA_URL);
  const apiOrigin = readOriginOrEmpty(process.env.SELLER_API_URL ?? (isDevelopmentBuild ? "http://localhost:8080" : undefined));
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", mediaOrigin].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", apiOrigin, ...(isDevelopmentBuild ? ["ws:"] : [])].filter(Boolean),
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://checkout.paystack.com", "https://checkout.flutterwave.com"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
  };
  return Object.entries(directives)
    .map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`)
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicyHeaderValue() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@zudomart/web-kit"],
  serverExternalPackages: [],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/serviceWorker.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/bff/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
