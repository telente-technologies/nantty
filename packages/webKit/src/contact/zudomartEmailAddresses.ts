export const zudomartMailboxDomain = "zudomart.com";
export const zudomartSendingDomain = "mail.zudomart.com";

export const zudomartMailboxNames = [
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

export type ZudomartMailboxName = (typeof zudomartMailboxNames)[number];
export type ZudomartEmailAddresses = Readonly<Record<ZudomartMailboxName, string>>;

function cleanDomain(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toLowerCase().replace(/^@/, "") ?? "";
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed) ? trimmed : fallback;
}

function cleanAddress(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export function buildZudomartEmailAddresses(options: { readonly domain?: string; readonly overrides?: Partial<Record<ZudomartMailboxName, string | undefined>> } = {}): ZudomartEmailAddresses {
  const domain = cleanDomain(options.domain, zudomartMailboxDomain);
  const entries = zudomartMailboxNames.map((name) => [name, cleanAddress(options.overrides?.[name]) ?? `${name}@${domain}`] as const);
  return Object.fromEntries(entries) as ZudomartEmailAddresses;
}

export function buildMailtoHref(address: string, subject?: string): string {
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}
