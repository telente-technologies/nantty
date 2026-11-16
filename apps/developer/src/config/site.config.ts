const isProduction = process.env.NODE_ENV === "production";

function readOrigin(value: string | undefined, variableName: string, developmentFallback: string): string {
  const configured = value?.trim();
  if (!configured) {
    if (isProduction) throw new Error(`${variableName} must be configured in production.`);
    return developmentFallback;
  }

  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !isProduction)) {
    throw new Error(`${variableName} must use HTTPS outside local development.`);
  }
  return url.origin;
}

export function readPublicSiteUrl(): string {
  return readOrigin(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL", "http://localhost:3700");
}

export function readDeveloperDocsUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DOCS_SITE_URL?.trim();
  const fallback = isProduction ? "https://docs.nantty.com" : "http://localhost:3700";
  return readOrigin(configured ?? fallback, "NEXT_PUBLIC_DOCS_SITE_URL", fallback);
}

/**
 * Keep docs on their own host in deployed environments while retaining the
 * /docs route locally, where the developer app is served on a single origin.
 */
export function readDeveloperDocsHref(path = ""): string {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  if (!isProduction) return normalizedPath ? `/docs/${normalizedPath}` : "/docs";
  return new URL(normalizedPath ? `/${normalizedPath}` : "/", readDeveloperDocsUrl()).toString();
}

export function readSandboxPortalUrl(): string {
  return readOrigin(process.env.NEXT_PUBLIC_SANDBOX_PORTAL_URL, "NEXT_PUBLIC_SANDBOX_PORTAL_URL", "http://localhost:3800");
}

export function readSandboxPublicApiUrl(): string {
  const fallback = isProduction ? "https://sandbox-api.nantty.com" : "http://localhost:8090";
  return readOrigin(process.env.SANDBOX_PUBLIC_API_URL, "SANDBOX_PUBLIC_API_URL", fallback);
}

export function readNanttyWebUrl(): string {
  return readOrigin(process.env.NEXT_PUBLIC_NANTTY_WEB_URL, "NEXT_PUBLIC_NANTTY_WEB_URL", "http://localhost:3500");
}

export function readDeveloperSupportUrl(): string {
  const supportUrl = new URL("/help/tickets/new?category=developer", readNanttyWebUrl());
  supportUrl.searchParams.set("subject", "Developer integration issue");
  return supportUrl.toString();
}
