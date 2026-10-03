import { openCookieSettingsEventName } from "./consentPolicy.constant";

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(openCookieSettingsEventName));
}
