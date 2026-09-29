export const dashboardProductName = "Zudomart Dashboard";

export function readPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/+$/, "");
}

export function readAdsManagerUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_ADS_MANAGER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://ads.zudomart.com" : "http://localhost:3300";
}

export const contactEmailRecipients = ["oyinlola.tech@icloud.com", "oluwayemioyinlola2@icloud.com"] as const;
export const contactMailtoHref = `mailto:${contactEmailRecipients.join(",")}`;
export const contactEmailDisplayText = contactEmailRecipients.join(" and ");

export function readMarketingSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://zudomart.com" : "http://localhost:3100";
}
