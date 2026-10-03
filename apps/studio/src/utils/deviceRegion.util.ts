export function detectDeviceLocaleTag(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en-US";
  }
}
