import { buildMailtoHref, buildStoreLinks, buildZudomartEmailAddresses } from "@zudomart/web-kit";

export const emailAddresses = buildZudomartEmailAddresses({
  domain: process.env.NEXT_PUBLIC_MAIL_DOMAIN,
  overrides: { creators: process.env.NEXT_PUBLIC_CREATORS_EMAIL, support: process.env.NEXT_PUBLIC_SUPPORT_EMAIL },
});

export const contactEmailRecipients = [emailAddresses.creators] as const;

export function buildContactMailtoLink(subject?: string): string {
  return buildMailtoHref(emailAddresses.creators, subject);
}

export const contactEmailDisplayText = emailAddresses.creators;

export const storeLinks = buildStoreLinks({ appStoreId: process.env.NEXT_PUBLIC_APP_STORE_ID, playPackage: process.env.NEXT_PUBLIC_PLAY_PACKAGE });
