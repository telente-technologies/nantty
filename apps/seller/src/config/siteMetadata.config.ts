import { buildMailtoHref, buildNanttyEmailAddresses } from "@nantty/web-kit/src/contact/nanttyEmailAddresses";
import { buildStoreLinks } from "@nantty/web-kit/src/storeBadges/storeLinks";

export const dashboardProductName = "Nantty Dashboard";

export function readPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/+$/, "");
}

export function readAdsManagerUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_ADS_MANAGER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://ads.nantty.com" : "http://localhost:3300";
}

export const emailAddresses = buildNanttyEmailAddresses({
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
  return process.env.NODE_ENV === "production" ? "https://nantty.com" : "http://localhost:3100";
}
