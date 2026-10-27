// Keep published help links valid after the seeded articles adopt Nantty slugs.
export const legacyHelpTopicSlugs = {
  "what-is-nantty": "what-is-zudomart",
  "owed-to-nantty": "owed-to-zudomart",
} as const;

export const canonicalHelpTopicSlugs: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(legacyHelpTopicSlugs).map(([canonical, legacy]) => [legacy, canonical]),
);
