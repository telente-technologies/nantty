"use client";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

import styles from "../authForm.module.css";
import { PasswordRequirements } from "./passwordRequirements";
import { DEFAULT_USERNAME_HINT, insertSlashesIntoBirthdayInput, isBirthdayValidForNewAccount, MINIMUM_ACCOUNT_AGE_IN_YEARS, parseBirthdayFromDayMonthYear } from "./signupRules.util";

interface ContactStepFieldsProps {
  readonly email: string;
  readonly onEmailChange: (email: string) => void;
  readonly saveLoginInfo: boolean;
  readonly onSaveLoginInfoChange: (save: boolean) => void;
  readonly busy: boolean;
  readonly canContinue: boolean;
}

export function ContactStepFields({ email, onEmailChange, saveLoginInfo, onSaveLoginInfoChange, busy, canContinue }: ContactStepFieldsProps) {
  return (
    <>
      <TextField
        label="Email"
        name="destination"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        hideLabel
      />

      <label className={styles.checkRow}>
        <input type="checkbox" checked={saveLoginInfo} onChange={(event) => onSaveLoginInfoChange(event.target.checked)} />
        <span className={styles.checkLabel}>Save login info on your device to log in automatically next time.</span>
      </label>

      <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canContinue}>
        Send Code
      </Button>
    </>
  );
}

export function BirthdayStepFields({ birthdayText, onBirthdayTextChange, canContinue }: { readonly birthdayText: string; readonly onBirthdayTextChange: (text: string) => void; readonly canContinue: boolean }) {
  return (
    <>
      <TextField
        label="Birthday"
        name="birthday"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        autoFocus
        value={birthdayText}
        onChange={(event) => onBirthdayTextChange(insertSlashesIntoBirthdayInput(event.target.value))}
        error={
          birthdayText.length === 10 && !isBirthdayValidForNewAccount(birthdayText)
            ? parseBirthdayFromDayMonthYear(birthdayText)
              ? `You must be at least ${MINIMUM_ACCOUNT_AGE_IN_YEARS} years old to use Zudomart.`
              : "Enter a real date, like 27/10/2000."
            : null
        }
      />
      <Button type="submit" fullWidth size="lg" disabled={!canContinue}>
        Next
      </Button>
    </>
  );
}

export function PasswordStepFields({ password, onPasswordChange, canContinue }: { readonly password: string; readonly onPasswordChange: (password: string) => void; readonly canContinue: boolean }) {
  return (
    <>
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Enter password"
        maxLength={20}
        autoFocus
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
      <PasswordRequirements password={password} />
      <Button type="submit" fullWidth size="lg" disabled={!canContinue}>
        Next
      </Button>
    </>
  );
}

interface UsernameStepFieldsProps {
  readonly username: string;
  readonly onUsernameChange: (username: string) => void;
  readonly error: string | null;
  readonly availabilityMessage: string | null | undefined;
  readonly isAvailableMessage: boolean;
  readonly suggestions: readonly string[];
  readonly onSuggestionSelect: (username: string) => void;
  readonly busy: boolean;
  readonly canContinue: boolean;
}

export function UsernameStepFields({ username, onUsernameChange, error, availabilityMessage, isAvailableMessage, suggestions, onSuggestionSelect, busy, canContinue }: UsernameStepFieldsProps) {
  return (
    <>
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        placeholder="Username"
        maxLength={20}
        autoFocus
        value={username}
        onChange={(event) => onUsernameChange(event.target.value.replace(/\s/g, ""))}
      />
      <p className={!error && isAvailableMessage ? styles.successText : error || availabilityMessage ? styles.errorText : styles.mutedText} aria-live="polite">
        {error ?? availabilityMessage ?? DEFAULT_USERNAME_HINT}
      </p>
      {suggestions.length > 0 ? (
        <div className={styles.suggestionGroup} role="group" aria-label="Suggested usernames">
          <p className={styles.mutedText}>Try one of these, or type your own</p>
          <ul className={styles.suggestionList}>
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button type="button" className={styles.suggestionChip} onClick={() => onSuggestionSelect(suggestion)}>
                  @{suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canContinue}>
        Confirm
      </Button>
    </>
  );
}
