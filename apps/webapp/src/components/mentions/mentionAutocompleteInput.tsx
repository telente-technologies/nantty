"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Avatar } from "@/components/ui/media";
import { mentionsService } from "@/services/mentions.service";
import { maximumMentionsPerText, type MentionSurface } from "@/types/mentions.type";
import { findActiveMentionQuery, insertMentionAtQuery, type ActiveMentionQuery, type MentionDraft } from "@/utils/mentions.util";

import styles from "./mentions.module.css";
import { AppIcon } from "@/components/ui/appIcon";

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
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly ariaLabel?: string;
  readonly ariaDescribedBy?: string;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function MentionAutocompleteInput({ id, value, onChange, chosenMentions, onChooseMention, placeholder, className, maxLength, autoFocus, enabled, surface, onFocus, multiline = false, rows = 4, ariaLabel, ariaDescribedBy }: MentionAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const listId = useId();
  const [activeQuery, setActiveQuery] = useState<ActiveMentionQuery | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const isAtMentionLimit = chosenMentions.length >= maximumMentionsPerText;
  const typedQuery = activeQuery?.query ?? "";
  const laggedQuery = useDebouncedValue(typedQuery, 150);
  const searchTerm = typedQuery === "" ? "" : laggedQuery;
  const suggestionsQuery = useQuery({
    queryKey: ["mentionCandidates", surface, searchTerm],
    queryFn: () => mentionsService.fetchMentionCandidates(surface, searchTerm),
    placeholderData: keepPreviousData,
    enabled: enabled && activeQuery !== null && !isAtMentionLimit,
    staleTime: 30_000,
    retry: false,
  });
  const suggestions = activeQuery && !isAtMentionLimit ? (suggestionsQuery.data?.candidates ?? []).slice(0, 10) : [];
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
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

  const sharedFieldProps = {
    id,
    className,
    value,
    maxLength,
    autoFocus,
    placeholder,
    role: "combobox" as const,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-autocomplete": "list" as const,
    "aria-expanded": isListOpen,
    "aria-controls": listId,
    "aria-activedescendant": isListOpen ? `${listId}-${highlightedIndex}` : undefined,
    onChange: (event: { readonly target: HTMLInputElement | HTMLTextAreaElement }) => {
      onChange(event.target.value);
      refreshActiveQuery(event.target.value, event.target.selectionStart ?? event.target.value.length);
    },
    onKeyDown: handleKeyDown,
    onFocus,
    onBlur: () => setTimeout(() => setActiveQuery(null), 120),
  };

  return (
    <div className={styles.inputWrap}>
      {multiline ? (
        <textarea ref={(node) => { inputRef.current = node; }} rows={rows} {...sharedFieldProps} />
      ) : (
        <input ref={(node) => { inputRef.current = node; }} {...sharedFieldProps} />
      )}
      {isListOpen ? (
        <ul className={styles.suggestions} id={listId} role="listbox" aria-label="People to mention">
          {suggestions.map(({ user: suggestion, allowsMentions, rank }, index) => (
            <Fragment key={suggestion.id}>
              {rank === "other" && index > 0 && suggestions[index - 1]!.rank !== "other" ? (
                <li role="presentation" className={styles.suggestionDivider}>More people on Nantty</li>
              ) : null}
            <li
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
              {suggestion.verified ? <span className={styles.suggestionBadge} aria-label="Verified account"><AppIcon name="check16" size={12} /></span> : null}
              <span className={styles.suggestionHandle}>@{suggestion.username}</span>
              {allowsMentions ? null : <span className={styles.suggestionNote}>Doesn't allow mentions</span>}
            </li>
            </Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
