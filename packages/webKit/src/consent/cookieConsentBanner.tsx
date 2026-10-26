/** @jsxRuntime automatic */
/** @jsxImportSource react */
"use client";

import { useEffect, useId, useState } from "react";

import { consentCategoryCopy, openCookieSettingsEventName, optionalConsentCategories, type ConsentChoice, type OptionalConsentCategory } from "./consentPolicy.constant";
import styles from "./cookieConsent.module.css";
import { writeConsentChoice } from "./consentStorage";
import { useConsentChoice, useConsentCookieText } from "./useConsent";

export interface CookieConsentBannerProps {
  readonly privacyPolicyHref?: string;
  readonly cookiePolicyHref?: string;
  readonly onChoiceSaved?: (choice: ConsentChoice) => void | Promise<void>;
  readonly isSignedIn?: boolean;
}

const syncedChoiceStorageKey = "zudomart_consent_synced_at";

const allGranted: Record<OptionalConsentCategory, boolean> = { analytics: true, personalization: true, advertising: true };
const noneGranted: Record<OptionalConsentCategory, boolean> = { analytics: false, personalization: false, advertising: false };

function hasChoiceBeenSynced(choice: ConsentChoice): boolean {
  try {
    return window.sessionStorage.getItem(syncedChoiceStorageKey) === choice.decidedAt;
  } catch {
    return false;
  }
}

export function CookieConsentBanner({ privacyPolicyHref = "/privacy", cookiePolicyHref = "/cookies", onChoiceSaved, isSignedIn = false }: CookieConsentBannerProps) {
  const cookieText = useConsentCookieText();
  const savedChoice = useConsentChoice();
  const [isReopened, setIsReopened] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [draft, setDraft] = useState<Record<OptionalConsentCategory, boolean>>(noneGranted);
  const headingId = useId();

  useEffect(() => {
    const reopen = () => {
      setDraft(savedChoice?.categories ?? noneGranted);
      setIsManaging(true);
      setIsReopened(true);
    };
    window.addEventListener(openCookieSettingsEventName, reopen);
    return () => window.removeEventListener(openCookieSettingsEventName, reopen);
  }, [savedChoice]);

  useEffect(() => {
    if (!isSignedIn || !savedChoice || !onChoiceSaved || hasChoiceBeenSynced(savedChoice)) return;
    void Promise.resolve(onChoiceSaved(savedChoice))
      .then(() => window.sessionStorage.setItem(syncedChoiceStorageKey, savedChoice.decidedAt))
      .catch(() => undefined);
  }, [isSignedIn, savedChoice, onChoiceSaved]);

  if (cookieText === null) return null;
  if (savedChoice && !isReopened) return null;

  function saveCategories(categories: Record<OptionalConsentCategory, boolean>) {
    writeConsentChoice(categories);
    setIsReopened(false);
    setIsManaging(false);
  }

  return (
    <section className={styles.banner} role="dialog" aria-modal="false" aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>Your privacy choices</h2>
      <p className={styles.text}>
        We use essential cookies to run Nantty. With your permission we also use analytics, personalization and advertising cookies. You can change this at any time. Read our <a href={cookiePolicyHref}>Cookie Policy</a> and <a href={privacyPolicyHref}>Privacy Policy</a>.
      </p>
      {isManaging ? (
        <ul className={styles.categoryList}>
          <li className={styles.categoryRow}>
            <span><strong>{consentCategoryCopy.essential.title}</strong><span className={styles.categoryText}>{consentCategoryCopy.essential.description}</span></span>
            <input type="checkbox" checked disabled aria-label="Essential cookies are always on" className={styles.toggle} />
          </li>
          {optionalConsentCategories.map((category) => (
            <li key={category} className={styles.categoryRow}>
              <label htmlFor={`${headingId}-${category}`}>
                <strong>{consentCategoryCopy[category].title}</strong>
                <span className={styles.categoryText}>{consentCategoryCopy[category].description}</span>
              </label>
              <input id={`${headingId}-${category}`} type="checkbox" className={styles.toggle} checked={draft[category]} onChange={(event) => setDraft((current) => ({ ...current, [category]: event.target.checked }))} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={() => saveCategories(noneGranted)}>Reject optional</button>
        {isManaging ? (
          <button type="button" className={styles.secondaryButton} onClick={() => saveCategories(draft)}>Save choices</button>
        ) : (
          <button type="button" className={styles.secondaryButton} onClick={() => { setDraft(savedChoice?.categories ?? noneGranted); setIsManaging(true); }}>Manage</button>
        )}
        <button type="button" className={styles.primaryButton} onClick={() => saveCategories(allGranted)}>Accept all</button>
      </div>
    </section>
  );
}
