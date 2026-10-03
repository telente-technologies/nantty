"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { Avatar } from "@/components/ui/media";
import { mentionsService } from "@/services/mentions.service";
import { maximumMentionsPerText, type MentionSurface } from "@/types/mentions.type";
import { findActiveMentionQuery, insertMentionAtQuery, type ActiveMentionQuery, type MentionDraft } from "@/utils/mentions.util";

import styles from "./mentions.module.css";

interface MentionAutocompleteInputProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly chosenMentions: readonly MentionDraft[];
  readonly onChooseMention: (mention: MentionDraft) => void;
  readonly placeholder: string;
  readonly className?: string;
  readonly maxLength: number;
  readonly autoFocus?: boolean;
  readonly enabled: boolean;
  readonly surface: MentionSurface;
  readonly onFocus?: () => void;
}

export function MentionAutocompleteInput({ id, value, onChange, chosenMentions, onChooseMention, placeholder, className, maxLength, autoFocus, enabled, surface, onFocus }: MentionAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const [activeQuery, setActiveQuery] = useState<ActiveMentionQuery | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const isAtMentionLimit = chosenMentions.length >= maximumMentionsPerText;
  const suggestionsQuery = useQuery({
    queryKey: ["mentionCandidates", surface, activeQuery?.query ?? ""],
    queryFn: () => mentionsService.fetchMentionCandidates(surface, activeQuery?.query ?? ""),
    enabled: enabled && activeQuery !== null && !isAtMentionLimit,
    staleTime: 30_000,
    retry: false,
  });
  const suggestions = activeQuery && !isAtMentionLimit ? (suggestionsQuery.data?.candidates ?? []).slice(0, 6) : [];
  const isListOpen = suggestions.length > 0;

  function refreshActiveQuery(nextValue: string, caretPosition: number) {
    setActiveQuery(findActiveMentionQuery(nextValue, caretPosition));
    setHighlightedIndex(0);
  }

  function chooseSuggestion(index: number) {
    const candidate = suggestions[index];
    if (!candidate || !candidate.allowsMentions || !activeQuery) return;
    const next = insertMentionAtQuery(value, activeQuery, candidate.user.username);
    onChange(next.text);
    onChooseMention({ userId: candidate.user.id, username: candidate.user.username });
    setActiveQuery(null);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.caretPosition, next.caretPosition));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isListOpen) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseSuggestion(highlightedIndex);
    } else if (event.key === "Escape") {
      setActiveQuery(null);
    }
  }

  return (
    <div className={styles.inputWrap}>
      <input
        ref={inputRef}
        id={id}
        className={className}
        value={value}
        maxLength={maxLength}
        autoFocus={autoFocus}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isListOpen}
        aria-controls={listId}
        aria-activedescendant={isListOpen ? `${listId}-${highlightedIndex}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          refreshActiveQuery(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => setActiveQuery(null), 120)}
      />
      {isListOpen ? (
        <ul className={styles.suggestions} id={listId} role="listbox" aria-label="People to mention">
          {suggestions.map(({ user: suggestion, allowsMentions }, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              aria-disabled={!allowsMentions}
              className={[styles.suggestion, index === highlightedIndex ? styles.suggestionActive : "", allowsMentions ? "" : styles.suggestionDisabled].join(" ")}
              onMouseDown={(event) => {
                event.preventDefault();
                chooseSuggestion(index);
              }}
            >
              <Avatar name={suggestion.name} src={suggestion.avatarUrl} size="xs" />
              <span className={styles.suggestionName}>{suggestion.name}</span>
              <span className={styles.suggestionHandle}>@{suggestion.username}</span>
              {allowsMentions ? null : <span className={styles.suggestionNote}>Doesn't allow mentions</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
