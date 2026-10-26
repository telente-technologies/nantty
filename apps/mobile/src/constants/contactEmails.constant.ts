const mailboxDomain = process.env.EXPO_PUBLIC_MAIL_DOMAIN?.trim() || "nantty.com";

export const ZUDOMART_EMAIL_ADDRESSES = {
  support: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || `support@${mailboxDomain}`,
  privacy: process.env.EXPO_PUBLIC_PRIVACY_EMAIL?.trim() || `privacy@${mailboxDomain}`,
  security: `security@${mailboxDomain}`,
  copyright: `copyright@${mailboxDomain}`,
} as const;

export const ZUDOMART_CONTACT_EMAIL_ADDRESSES = [ZUDOMART_EMAIL_ADDRESSES.support] as const;

export const buildContactMailtoUrl = (subject?: string, address: string = ZUDOMART_EMAIL_ADDRESSES.support) =>
  `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
