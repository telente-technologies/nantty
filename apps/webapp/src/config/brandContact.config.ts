import { buildStoreLinks, buildNanttyEmailAddresses } from "@nantty/web-kit";

export const emailAddresses = buildNanttyEmailAddresses({
  domain: process.env.NEXT_PUBLIC_MAIL_DOMAIN,
  overrides: { support: process.env.NEXT_PUBLIC_SUPPORT_EMAIL, privacy: process.env.NEXT_PUBLIC_PRIVACY_EMAIL },
});

export const storeLinks = buildStoreLinks({ appStoreId: process.env.NEXT_PUBLIC_APP_STORE_ID, playPackage: process.env.NEXT_PUBLIC_PLAY_PACKAGE });
