"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { ConsentCategory, ConsentChoice } from "./consentPolicy.constant";
import { parseConsentCookieText, readConsentCookieText, subscribeToConsentChanges } from "./consentStorage";

function readServerSnapshot(): null {
  return null;
}

export function useConsentCookieText(): string | null {
  return useSyncExternalStore(subscribeToConsentChanges, readConsentCookieText, readServerSnapshot);
}

export function useConsentChoice(): ConsentChoice | null {
  const cookieText = useConsentCookieText();
  return useMemo(() => (cookieText === null ? null : parseConsentCookieText(cookieText)), [cookieText]);
}

export function useConsent(category: ConsentCategory): boolean {
  const choice = useConsentChoice();
  if (category === "essential") return true;
  return choice?.categories[category] === true;
}
