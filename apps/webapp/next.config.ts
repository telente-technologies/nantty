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

function readMediaUploadOrigins(): string[] {
  const listed = (process.env.WEBAPP_UPLOAD_ORIGINS ?? "").split(",").map((origin) => readOriginOrEmpty(origin.trim()));
  const publicEndpoint = readOriginOrEmpty(process.env.S3_PUBLIC_ENDPOINT ?? (isDevelopmentBuild ? "http://localhost:18333" : undefined));
  const bucket = process.env.MEDIA_QUARANTINE_BUCKET ?? "zudomart-media-quarantine";
  const region = process.env.S3_REGION ?? "eu-west-1";
  const awsBucketOrigin = publicEndpoint === "" ? `https://${bucket}.s3.${region}.amazonaws.com` : "";
  return [...new Set([...listed, publicEndpoint, awsBucketOrigin].filter(Boolean))];
}

const contentSecurityPolicyDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
  "frame-src": ["https://challenges.cloudflare.com"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
  "font-src": ["'self'"],
  "connect-src": ["'self'", ...readMediaUploadOrigins()],
  "media-src": ["'self'", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "manifest-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
};

const serializeContentSecurityPolicy = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`)
    .join("; ");

const contentSecurityPolicy = serializeContentSecurityPolicy(contentSecurityPolicyDirectives);

const smileIdOrigins = ["https://cdn.smileidentity.com", "https://*.smileidentity.com", "https://*.usesmileid.com"];
const identityVerificationContentSecurityPolicy = serializeContentSecurityPolicy({
  ...contentSecurityPolicyDirectives,
  "script-src": [...(contentSecurityPolicyDirectives["script-src"] ?? []), "https://cdn.smileidentity.com"],
  "frame-src": [...(contentSecurityPolicyDirectives["frame-src"] ?? []), ...smileIdOrigins],
  "connect-src": [...(contentSecurityPolicyDirectives["connect-src"] ?? []), ...smileIdOrigins],
  "worker-src": [...(contentSecurityPolicyDirectives["worker-src"] ?? []), ...smileIdOrigins],
});

const identityVerificationHeaders = [
  { key: "Content-Security-Policy", value: identityVerificationContentSecurityPolicy },
  { key: "Permissions-Policy", value: 'camera=(self "https://cdn.smileidentity.com"), microphone=(), geolocation=(), payment=()' },
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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

const everyPathExceptEmbeds = "/:path((?!embed(?:/|$)|oembed(?:/|$)).*)";

const nextConfig: NextConfig = {
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
      { source: "/embed/:path*", headers: embedBaselineHeaders },
      { source: "/oembed", headers: embedBaselineHeaders },
    ];
  },
};

export default nextConfig;
