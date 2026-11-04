export function getSafeTrackingUrl(value: string | null | undefined): string | null {
  const trackingUrl = value?.trim();
  if (!trackingUrl || trackingUrl.length > 300 || /\s/.test(trackingUrl) || !/^https:\/\/[^/?#\\]+/.test(trackingUrl)) return null;

  try {
    const parsedUrl = new URL(trackingUrl);
    if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) return null;
    return trackingUrl;
  } catch {
    return null;
  }
}

export function isValidOptionalTrackingUrl(value: string): boolean {
  return value.trim().length === 0 || getSafeTrackingUrl(value) !== null;
}
