// Keep published help links valid after the seeded articles adopt Nantty slugs.
export const legacyHelpTopicSlugs = {
  "nantty-points": "nanttypoints",
} as const;

export const canonicalHelpTopicSlugs: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(legacyHelpTopicSlugs).map(([canonical, legacy]) => [legacy, canonical]),
);
