export const contactEmailRecipients = ["oyinlola.tech@icloud.com", "oluwayemioyinlola2@icloud.com"] as const;

export function buildContactMailtoLinkForBothAddresses(subject?: string): string {
  const recipients = contactEmailRecipients.join(",");
  return subject ? `mailto:${recipients}?subject=${encodeURIComponent(subject)}` : `mailto:${recipients}`;
}

export const contactEmailDisplayText = contactEmailRecipients.join(" and ");

export function readZudomartMainSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://zudomart.com";
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "https://zudomart.com";
  }
}
