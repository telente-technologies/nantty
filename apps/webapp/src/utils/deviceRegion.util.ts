export function detectDeviceRegionCode(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(locale).region ?? locale.split("-")[1];
    return region && /^[A-Z]{2}$/i.test(region) ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function detectDeviceLocaleTag(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en-US";
  }
}
