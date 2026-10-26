import type { NextConfig } from "next";


// Content-Security-Policy is built per request in src/proxy.ts, so origins come from the runtime env, not the build.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  ...(process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1" ? { output: "export" as const, images: { unoptimized: true } } : {}),
  experimental: { authInterrupts: true },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@nantty/web-kit", "@nantty/chat-crypto"],
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
      { source: "/bff/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
    ];
  },
};

export default nextConfig;
