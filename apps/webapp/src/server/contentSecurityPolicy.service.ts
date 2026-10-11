const isDevelopmentBuild = process.env.NODE_ENV === "development";

const smileIdOrigins = ["https://cdn.smileidentity.com", "https://*.smileidentity.com", "https://*.usesmileid.com"];

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

function readMediaUploadOrigins(): string[] {
  const listed = (readRuntimeEnv("WEBAPP_UPLOAD_ORIGINS") ?? "").split(",").map((origin) => readOriginOrEmpty(origin.trim()));
  const publicEndpoint = readOriginOrEmpty(readRuntimeEnv("S3_PUBLIC_ENDPOINT") ?? (isDevelopmentBuild ? "http://localhost:18333" : undefined));
  const bucket = readRuntimeEnv("MEDIA_QUARANTINE_BUCKET") ?? "zudomart-media-quarantine";
  const region = readRuntimeEnv("S3_REGION") ?? "eu-west-1";
  const awsBucketOrigin = publicEndpoint === "" ? `https://${bucket}.s3.${region}.amazonaws.com` : "";
  return [...new Set([...listed, publicEndpoint, awsBucketOrigin].filter(Boolean))];
}

export function readLiveKitOrigins(configured = readRuntimeEnv("WEBAPP_LIVEKIT_URL") ?? (isDevelopmentBuild ? "ws://localhost:7880" : undefined)): string[] {
  if (!configured) return [];
  try {
    const url = new URL(configured);
    if (!["ws:", "wss:", "http:", "https:"].includes(url.protocol) || url.host === "") return [];
    const secure = url.protocol === "wss:" || url.protocol === "https:";
    const origins = [`${secure ? "wss" : "ws"}://${url.host}`, `${secure ? "https" : "http"}://${url.host}`];
    return url.hostname.endsWith(".livekit.cloud") ? [...origins, "wss://*.livekit.cloud", "https://*.livekit.cloud"] : origins;
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicyHeaderValue(options: { readonly isIdentityVerification?: boolean } = {}): string {
  const extraOrigins = options.isIdentityVerification ? smileIdOrigins : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com", ...(isDevelopmentBuild ? ["'unsafe-eval'"] : []), ...(options.isIdentityVerification ? ["https://cdn.smileidentity.com"] : [])],
    "frame-src": ["https://challenges.cloudflare.com", ...extraOrigins],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...readMediaUploadOrigins(), ...readLiveKitOrigins(), ...extraOrigins],
    "media-src": ["'self'", "https:", ...(isDevelopmentBuild ? ["http:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:", ...extraOrigins],
  };
  return Object.entries(directives)
    .map(([directiveName, sources]) => `${directiveName} ${sources.join(" ")}`)
    .join("; ");
}
