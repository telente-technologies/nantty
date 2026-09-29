export const dashboardProductName = "Zudomart Dashboard";

export function readPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/+$/, "");
}

export function readAdsManagerUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_ADS_MANAGER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://ads.zudomart.com" : "http://localhost:3300";
}
