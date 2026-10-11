const isDevelopmentBuild = process.env.NODE_ENV === "development";

// Read with a computed name so the value always comes from the running server, never from the build machine.
function readRuntimeEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function readOriginOrEmpty(configuredUrl: string | undefined): string {
  if (!configuredUrl) return "";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "";
  }
}

export function buildContentSecurityPolicyHeaderValue(): string {
  const mediaOrigin = readOriginOrEmpty(readRuntimeEnv("SELLER_MEDIA_URL"));
  const apiOrigin = readOriginOrEmpty(readRuntimeEnv("SELLER_API_URL") ?? (isDevelopmentBuild ? "http://localhost:8080" : undefined));
  const embedOrigin = readOriginOrEmpty(readRuntimeEnv("NEXT_PUBLIC_WEBAPP_URL") ?? (isDevelopmentBuild ? "http://localhost:3500" : "https://app.zudomart.com"));
  const realtimeOrigin = readOriginOrEmpty((readRuntimeEnv("SELLER_REALTIME_URL") ?? (apiOrigin ? `${apiOrigin}/ws` : "")).replace(/^http(s?):\/\//i, (_, secure: string) => (secure ? "wss://" : "ws://")));
  const uploadOrigins = (readRuntimeEnv("SELLER_UPLOAD_ORIGINS") ?? "").split(",").map((origin) => readOriginOrEmpty(origin.trim())).filter(Boolean);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://images.unsplash.com", mediaOrigin].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", apiOrigin, realtimeOrigin, mediaOrigin, ...uploadOrigins, ...(isDevelopmentBuild ? ["ws:"] : [])].filter(Boolean),
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://checkout.flutterwave.com"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'self'", "blob:", embedOrigin].filter(Boolean),
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
  };
  return Object.entries(directives)
    .map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`)
    .join("; ");
}
