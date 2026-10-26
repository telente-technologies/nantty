import type { NextConfig } from "next";

const isDevelopmentBuild = process.env.NODE_ENV === "development";

function readApiOriginForConnectSource(): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? (isDevelopmentBuild ? "http://localhost:3000" : "");
  try {
    return configuredApiUrl ? new URL(configuredApiUrl).origin : "";
  } catch {
    return "";
  }
}

function buildContentSecurityPolicyHeaderValue(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", readApiOriginForConnectSource(), ...(isDevelopmentBuild ? ["ws:"] : [])].filter(Boolean),
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@nantty/web-kit"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
