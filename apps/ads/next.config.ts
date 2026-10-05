import type { NextConfig } from "next";

const isDevelopmentBuild = process.env.NODE_ENV === "development";
const hostedCheckoutOrigins = ["https://checkout.paystack.com", "https://checkout.flutterwave.com"];

function readOriginOrEmpty(configuredUrl: string | undefined): string {
  if (!configuredUrl) return "";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "";
  }
}

function buildContentSecurityPolicyHeaderValue(): string {
  const mediaOrigin = readOriginOrEmpty(process.env.ADS_MEDIA_URL);
  const uploadOrigin = readOriginOrEmpty(process.env.ADS_UPLOAD_URL);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", mediaOrigin].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", uploadOrigin, ...(isDevelopmentBuild ? ["ws:"] : [])].filter(Boolean),
    "media-src": ["'self'", "blob:", mediaOrigin].filter(Boolean),
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...hostedCheckoutOrigins],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    ...(isDevelopmentBuild ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([directiveName, sources]) => [directiveName, ...sources].join(" "))
    .join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicyHeaderValue() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zudomart/web-kit"],
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/bff/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
