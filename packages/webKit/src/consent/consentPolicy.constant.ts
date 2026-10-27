export const consentPolicyVersion = "1.0";
export const consentCookieName = "nantty_consent";
export const consentCookieMaxAgeSeconds = 60 * 60 * 24 * 180;
export const openCookieSettingsEventName = "nantty:open-cookie-settings";
export const consentChangedEventName = "nantty:consent-changed";

export const consentCategories = ["essential", "analytics", "personalization", "advertising"] as const;
export type ConsentCategory = (typeof consentCategories)[number];
export type OptionalConsentCategory = Exclude<ConsentCategory, "essential">;
export const optionalConsentCategories: readonly OptionalConsentCategory[] = ["analytics", "personalization", "advertising"];

export const consentCategoryCopy: Record<ConsentCategory, { readonly title: string; readonly description: string }> = {
  essential: { title: "Essential", description: "Keeps you signed in, protects your account and remembers this choice. Always on." },
  analytics: { title: "Analytics", description: "Helps us understand how the product is used so we can fix problems and improve it." },
  personalization: { title: "Personalization", description: "Remembers your preferences and tailors what you see, such as suggestions." },
  advertising: { title: "Advertising", description: "Lets us measure ads and show ads that are more relevant to you." },
};

export interface ConsentChoice {
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly categories: Record<OptionalConsentCategory, boolean>;
}
