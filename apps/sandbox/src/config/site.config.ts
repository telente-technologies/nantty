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
  return readOrigin(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL", "http://localhost:3800");
}

export function readDeveloperPortalUrl(): string {
  return readOrigin(process.env.NEXT_PUBLIC_DEVELOPER_PORTAL_URL, "NEXT_PUBLIC_DEVELOPER_PORTAL_URL", "http://localhost:3700");
}

export function readNanttyWebUrl(): string {
  return readOrigin(process.env.NEXT_PUBLIC_NANTTY_WEB_URL, "NEXT_PUBLIC_NANTTY_WEB_URL", "http://localhost:3500");
}

export function readSandboxSupportUrl(): string {
  const supportUrl = new URL("/help/tickets/new?category=sandbox", readNanttyWebUrl());
  supportUrl.searchParams.set("subject", "API sandbox issue");
  return supportUrl.toString();
}
