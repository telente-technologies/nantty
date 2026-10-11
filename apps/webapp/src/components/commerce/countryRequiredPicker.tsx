"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";
import { countryChoices, countryRequiredCode, isCountryRequiredCode, resolveCountryChoice } from "@/utils/countryRequired.util";

import styles from "./countryRequiredPicker.module.css";

export { countryRequiredCode };

export const countryRequiredTitle = "Where do you live?";
export const countryRequiredNote = "We charge you in your country's currency. You only need to tell us once; you can change it later in settings.";

export function isCountryRequiredError(error: unknown): boolean {
  return error instanceof WebappRequestError && isCountryRequiredCode(error.code);
}

export function CountryRequiredPicker({ onSaved, showHeading = true }: { readonly onSaved: (countryCode: string) => void; readonly showHeading?: boolean }) {
  const [choice, setChoice] = useState<string>("NG");
  const [otherCode, setOtherCode] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countryCode = resolveCountryChoice(choice, otherCode);
  const isValid = countryCode !== null;

  async function save() {
    if (countryCode === null) return;
    setSaving(true);
    setError(null);
    try {
      await usersService.updateMyCountryPreference(countryCode);
      onSaved(countryCode);
    } catch (caught) {
      setError(readErrorMessageForDisplay(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.picker} aria-labelledby={showHeading ? "country-required-title" : undefined} aria-label={showHeading ? undefined : "Your country"}>
      {showHeading ? (
        <>
          <h2 id="country-required-title" className={styles.title}>{countryRequiredTitle}</h2>
          <p className={styles.note}>{countryRequiredNote}</p>
        </>
      ) : null}
      <div className={styles.choices} role="radiogroup" aria-label="Your country">
        {countryChoices.map((option) => (
          <label key={option.code} className={[styles.choice, choice === option.code ? styles.choiceActive : ""].filter(Boolean).join(" ")}>
            <input type="radio" name="country" value={option.code} checked={choice === option.code} onChange={() => setChoice(option.code)} />
            {option.label}
          </label>
        ))}
      </div>
      {choice === "other" ? (
        <label className={styles.otherField}>
          <span>Two-letter country code (for example US or GB)</span>
          <input value={otherCode} maxLength={2} autoCapitalize="characters" onChange={(event) => setOtherCode(event.target.value)} />
        </label>
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <Button onClick={save} disabled={!isValid} busy={isSaving}>Save and continue</Button>
    </section>
  );
}
