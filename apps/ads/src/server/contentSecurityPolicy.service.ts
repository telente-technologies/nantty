const isDevelopmentBuild = process.env.NODE_ENV === "development";
const hostedCheckoutOrigins = ["https://checkout.flutterwave.com", "https://checkout-testing.flutterwave.com"];

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
  const mediaOrigin = readOriginOrEmpty(readRuntimeEnv("ADS_MEDIA_URL"));
  const uploadOrigin = readOriginOrEmpty(readRuntimeEnv("ADS_UPLOAD_URL"));
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
