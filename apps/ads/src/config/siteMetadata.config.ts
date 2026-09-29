export const adsManagerProductName = "Zudomart Ads Manager";

export function readPublicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3300";
}
