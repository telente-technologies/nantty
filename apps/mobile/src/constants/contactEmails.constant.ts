export const ZUDOMART_CONTACT_EMAIL_ADDRESSES = ["oyinlola.tech@icloud.com", "oluwayemioyinlola2@icloud.com"] as const;

export const buildContactMailtoUrl = (subject?: string) =>
  `mailto:${ZUDOMART_CONTACT_EMAIL_ADDRESSES.join(",")}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
