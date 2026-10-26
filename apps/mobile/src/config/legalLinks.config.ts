const MARKETING_SITE_URL = process.env.EXPO_PUBLIC_MARKETING_SITE_URL || "https://nantty.com";

export const CURRENT_POLICY_VERSION = "2026-10-01";

export const legalLinks = {
  privacyPolicy: `${MARKETING_SITE_URL}/privacy`,
  cookiePolicy: `${MARKETING_SITE_URL}/cookies`,
  terms: `${MARKETING_SITE_URL}/terms`,
  communityGuidelines: `${MARKETING_SITE_URL}/community-guidelines`,
  dataRights: `${MARKETING_SITE_URL}/data-rights`,
} as const;
