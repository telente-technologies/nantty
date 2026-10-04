import { buildMailtoHref, buildStoreLinks, buildZudomartEmailAddresses } from "@zudomart/web-kit";

export const dashboardProductName = "Zudomart Dashboard";

export function readPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/+$/, "");
}

export function readAdsManagerUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_ADS_MANAGER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://ads.zudomart.com" : "http://localhost:3300";
}

export const emailAddresses = buildZudomartEmailAddresses({
  domain: process.env.NEXT_PUBLIC_MAIL_DOMAIN,
  overrides: { sellers: process.env.NEXT_PUBLIC_SELLERS_EMAIL, support: process.env.NEXT_PUBLIC_SUPPORT_EMAIL },
});
export const contactEmailRecipients = [emailAddresses.sellers] as const;
export const contactMailtoHref = buildMailtoHref(emailAddresses.sellers);
export const contactEmailDisplayText = emailAddresses.sellers;

export const storeLinks = buildStoreLinks({ appStoreId: process.env.NEXT_PUBLIC_APP_STORE_ID, playPackage: process.env.NEXT_PUBLIC_PLAY_PACKAGE });

export function readMarketingSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://zudomart.com" : "http://localhost:3100";
}
