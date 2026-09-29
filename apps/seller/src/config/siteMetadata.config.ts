export const dashboardProductName = "Zudomart Dashboard";

export function readPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/+$/, "");
}
