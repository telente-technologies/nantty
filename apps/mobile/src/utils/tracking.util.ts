export function isValidOptionalTrackingUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized.length > 300 || /\s/.test(normalized)) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function isValidTrackingNumber(value: string): boolean {
  return /^[A-Za-z0-9-]{4,40}$/.test(value.trim());
}
