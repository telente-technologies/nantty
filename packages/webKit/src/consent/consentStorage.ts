import { consentChangedEventName, consentCookieMaxAgeSeconds, consentCookieName, consentPolicyVersion, optionalConsentCategories, type ConsentChoice, type OptionalConsentCategory } from "./consentPolicy.constant";

export function readConsentCookieText(): string {
  if (typeof document === "undefined") return "";
  const entry = document.cookie.split("; ").find((cookiePart) => cookiePart.startsWith(`${consentCookieName}=`));
  return entry ? entry.slice(consentCookieName.length + 1) : "";
}

export function parseConsentCookieText(cookieText: string): ConsentChoice | null {
  if (!cookieText) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieText)) as Partial<ConsentChoice>;
    if (parsed.policyVersion !== consentPolicyVersion || typeof parsed.decidedAt !== "string" || !parsed.categories) return null;
    const categories = Object.fromEntries(optionalConsentCategories.map((category) => [category, parsed.categories?.[category] === true])) as Record<OptionalConsentCategory, boolean>;
    return { policyVersion: parsed.policyVersion, decidedAt: parsed.decidedAt, categories };
  } catch {
    return null;
  }
}

export function writeConsentChoice(categories: Record<OptionalConsentCategory, boolean>): ConsentChoice {
  const choice: ConsentChoice = { policyVersion: consentPolicyVersion, decidedAt: new Date().toISOString(), categories };
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${consentCookieName}=${encodeURIComponent(JSON.stringify(choice))}; Path=/; Max-Age=${consentCookieMaxAgeSeconds}; SameSite=Lax${secureFlag}`;
  window.dispatchEvent(new Event(consentChangedEventName));
  return choice;
}

export function subscribeToConsentChanges(onChange: () => void): () => void {
  window.addEventListener(consentChangedEventName, onChange);
  return () => window.removeEventListener(consentChangedEventName, onChange);
}
