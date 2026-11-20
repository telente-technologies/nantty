export const docGuideSlugs = [
  "business-messaging",
  "messaging",
  "quickstart",
  "api-reference",
  "authentication",
  "webhooks",
  "sandbox",
  "errors",
  "rate-limits",
  "billing",
] as const;

export type DocGuideSlug = (typeof docGuideSlugs)[number];
