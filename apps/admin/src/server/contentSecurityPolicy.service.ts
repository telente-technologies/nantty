import { readPrivateMediaOrigin } from "@/config/adminEnvironment.config";

const isDevelopmentBuild = process.env.NODE_ENV === "development";

export function createContentSecurityPolicyNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64");
}

export function buildContentSecurityPolicyHeaderValue(nonce: string): string {
  const mediaOrigin = readPrivateMediaOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'none'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
    "style-src": isDevelopmentBuild ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://images.pexels.com", mediaOrigin].filter(Boolean),
    "media-src": ["'self'", "blob:", mediaOrigin].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDevelopmentBuild ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
  };
  const serialized = Object.entries(directives).map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`);
  if (!isDevelopmentBuild) serialized.push("upgrade-insecure-requests");
  return serialized.join("; ");
}
