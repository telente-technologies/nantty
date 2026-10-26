// Keep the legacy export names for source compatibility; the default brand domain is Nantty.
export const nanttyMailboxDomain = "nantty.com";
export const nanttySendingDomain = "mail.zudomart.com";

export const nanttyMailboxNames = [
  "support",
  "help",
  "billing",
  "payouts",
  "sellers",
  "creators",
  "ads",
  "legal",
  "privacy",
  "dpo",
  "security",
  "abuse",
  "copyright",
  "trustandsafety",
  "verification",
  "partnerships",
  "press",
  "careers",
  "hello",
] as const;

export type NanttyMailboxName = (typeof nanttyMailboxNames)[number];
export type NanttyEmailAddresses = Readonly<Record<NanttyMailboxName, string>>;

function cleanDomain(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toLowerCase().replace(/^@/, "") ?? "";
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed) ? trimmed : fallback;
}

function cleanAddress(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export function buildNanttyEmailAddresses(options: { readonly domain?: string; readonly overrides?: Partial<Record<NanttyMailboxName, string | undefined>> } = {}): NanttyEmailAddresses {
  const domain = cleanDomain(options.domain, nanttyMailboxDomain);
  const entries = nanttyMailboxNames.map((name) => [name, cleanAddress(options.overrides?.[name]) ?? `${name}@${domain}`] as const);
  return Object.fromEntries(entries) as NanttyEmailAddresses;
}

export function buildMailtoHref(address: string, subject?: string): string {
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}
