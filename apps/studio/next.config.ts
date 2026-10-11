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

const embedPreviewOrigin = readOriginOrEmpty(process.env.NEXT_PUBLIC_WEBAPP_URL ?? (isDevelopmentBuild ? "http://localhost:3500" : "https://app.zudomart.com"));

const contentSecurityPolicyDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "media-src": ["'self'", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "frame-src": [embedPreviewOrigin].filter(Boolean),
  "manifest-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
};

const contentSecurityPolicy = Object.entries(contentSecurityPolicyDirectives)
  .map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  reactStrictMode: true,
  transpilePackages: ["@zudomart/web-kit"],
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }, ...(isDevelopmentBuild ? [{ protocol: "http" as const, hostname: "**" }] : [])],
    dangerouslyAllowLocalIP: isDevelopmentBuild,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
