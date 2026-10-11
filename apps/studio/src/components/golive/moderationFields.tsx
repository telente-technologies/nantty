"use client";

import { useId, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { CloseIcon } from "@/components/ui/icons";
import type { CommentAudience, RoomSettingsInput } from "@/types/studioLive.type";
import { addBlockedWords, MAX_BLOCKED_WORDS } from "@/utils/blockedWords.util";

import styles from "./moderation.module.css";

const AUDIENCE_OPTIONS: readonly { readonly value: CommentAudience | "nobody"; readonly label: string; readonly detail: string }[] = [
  { value: "everyone", label: "Everyone", detail: "Anyone watching can comment." },
  { value: "followers", label: "Followers", detail: "Only people who follow you." },
  { value: "subscribers", label: "Subscribers", detail: "Only your paying subscribers." },
  { value: "nobody", label: "No one", detail: "Chat is turned off." },
];

const SLOW_MODE_OPTIONS = [0, 3, 5, 10, 30, 60, 120, 300];

const describeSlowMode = (seconds: number) => (seconds === 0 ? "Off" : seconds < 60 ? `One comment every ${seconds} seconds` : `One comment every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`);

export function ModerationFields({ value, onChange }: { readonly value: RoomSettingsInput; readonly onChange: (next: RoomSettingsInput) => void }) {
  const groupId = useId();
  const [draftWord, setDraftWord] = useState("");
  const [wordError, setWordError] = useState<string | null>(null);
  const audience = value.commentsEnabled ? value.commentAudience : "nobody";

  function addWords() {
    const result = addBlockedWords(value.blockedWords, draftWord);
    setWordError(result.error);
    if (!result.error) {
      onChange({ ...value, blockedWords: result.words });
      setDraftWord("");
    }
  }

  function onWordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addWords();
    }
  }

  return (
    <div className={styles.fields}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Who can comment</legend>
        <div className={styles.radioGrid}>
          {AUDIENCE_OPTIONS.map((option) => (
            <label key={option.value} className={styles.radioCard}>
              <input
                type="radio"
                name={`${groupId}-audience`}
                value={option.value}
                checked={audience === option.value}
                onChange={() => onChange(option.value === "nobody" ? { ...value, commentsEnabled: false } : { ...value, commentsEnabled: true, commentAudience: option.value })}
              />
              <span>
                <strong>{option.label}</strong>
                <span className={styles.muted}>{option.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <SelectField label="Slow mode" hint="Limits how often each viewer can comment. You and your moderators are never slowed down." value={String(value.slowModeSeconds)} onChange={(event) => onChange({ ...value, slowModeSeconds: Number(event.target.value) })}>
        {SLOW_MODE_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{describeSlowMode(seconds)}</option>)}
      </SelectField>

      <div className={styles.fieldset}>
        <label className={styles.legend} htmlFor={`${groupId}-word`}>Blocked words</label>
        <p className={styles.muted} id={`${groupId}-word-hint`}>
          Comments containing these are hidden. Matching ignores capitals, punctuation or emoji around a word, and look-alike characters such as 0 for o. Separate several with commas.
        </p>
        <div className={styles.wordInputRow}>
          <input
            id={`${groupId}-word`}
            className={styles.input}
            value={draftWord}
            maxLength={400}
            aria-describedby={`${groupId}-word-hint${wordError ? ` ${groupId}-word-error` : ""}`}
            aria-invalid={wordError ? true : undefined}
            onChange={(event) => setDraftWord(event.target.value)}
            onKeyDown={onWordKeyDown}
            placeholder="e.g. scam, fake giveaway"
          />
          <Button variant="secondary" onClick={addWords} disabled={value.blockedWords.length >= MAX_BLOCKED_WORDS}>Add</Button>
        </div>
        {wordError ? <p className={styles.error} id={`${groupId}-word-error`} role="alert">{wordError}</p> : null}
        {value.blockedWords.length > 0 ? (
          <ul className={styles.chips} aria-label={`${value.blockedWords.length} blocked words`}>
            {value.blockedWords.map((word) => (
              <li key={word} className={styles.chip}>
                <span>{word}</span>
                <button type="button" className={styles.chipRemove} aria-label={`Remove ${word}`} onClick={() => onChange({ ...value, blockedWords: value.blockedWords.filter((entry) => entry !== word) })}>
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No blocked words yet.</p>
        )}
      </div>
    </div>
  );
}
