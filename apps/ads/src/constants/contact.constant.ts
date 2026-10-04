import { buildMailtoHref, buildStoreLinks, buildZudomartEmailAddresses } from "@zudomart/web-kit";

export const emailAddresses = buildZudomartEmailAddresses({
  domain: process.env.NEXT_PUBLIC_MAIL_DOMAIN,
  overrides: { ads: process.env.NEXT_PUBLIC_ADS_EMAIL, billing: process.env.NEXT_PUBLIC_BILLING_EMAIL },
});

export const contactEmailRecipients = [emailAddresses.ads] as const;

export function buildContactMailtoLink(subject?: string): string {
  return buildMailtoHref(emailAddresses.ads, subject);
}

export const contactEmailDisplayText = emailAddresses.ads;

export const storeLinks = buildStoreLinks({ appStoreId: process.env.NEXT_PUBLIC_APP_STORE_ID, playPackage: process.env.NEXT_PUBLIC_PLAY_PACKAGE });

export function readZudomartMainSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://zudomart.com";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "https://zudomart.com";
  }
}
