export function buildSafePhoneLink(phone: string): string | null {
  const normalized = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{6,20}$/.test(normalized) ? `tel:${normalized}` : null;
}
