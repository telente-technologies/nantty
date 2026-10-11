import type { NextConfig } from "next";

const isDevelopmentBuild = process.env.NODE_ENV === "development";

// Content-Security-Policy is built per request in src/proxy.ts, so origins come from the runtime env, not the build.
const identityVerificationHeaders = [
  { key: "Permissions-Policy", value: 'camera=(self "https://cdn.smileidentity.com"), microphone=(), geolocation=(), payment=()' },
];

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const embedBaselineHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const backendForFrontendHeaders = [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }];

const everyPathExceptEmbeds = "/:path((?!embed(?:/|$)|oembed(?:/|$)).*)";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  reactStrictMode: true,
  transpilePackages: ["@zudomart/web-kit", "@zudomart/chat-crypto"],
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }, ...(isDevelopmentBuild ? [{ protocol: "http" as const, hostname: "**" }] : [])],
    dangerouslyAllowLocalIP: isDevelopmentBuild,
  },
  async headers() {
    return [
      { source: everyPathExceptEmbeds, headers: securityHeaders },
      { source: "/settings/verification", headers: identityVerificationHeaders },
      { source: "/bff/:path*", headers: backendForFrontendHeaders },
      { source: "/embed/:path*", headers: embedBaselineHeaders },
      { source: "/oembed", headers: embedBaselineHeaders },
    ];
  },
};

export default nextConfig;
