/** Build a dialer link only from a phone-shaped value returned by the API. */
export function buildSafePhoneLink(phone: string): string | null {
  const trimmed = phone.trim();
  if (!/^\+?[\d\s().-]{6,30}$/.test(trimmed)) return null;

  const normalized = trimmed.replace(/[\s().-]/g, "");
  return /^\+?\d{6,20}$/.test(normalized) ? `tel:${normalized}` : null;
}
