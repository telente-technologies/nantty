const isProduction = process.env.NODE_ENV === "production";

export function readPublicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (isProduction) throw new Error("NEXT_PUBLIC_SITE_URL must be configured in production.");
  return "http://localhost:3700";
}
