const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com";

export const currentPolicyVersion = "2026-10-01";

export const legalLinks = {
  privacyPolicy: `${marketingSiteUrl}/privacy`,
  cookiePolicy: `${marketingSiteUrl}/cookies`,
  terms: `${marketingSiteUrl}/terms`,
  dataRights: `${marketingSiteUrl}/data-rights`,
} as const;
