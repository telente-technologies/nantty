"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { NanttyIcon } from "@/components/ui/nanttyIcon";

import styles from "./searchableMultiSelect.module.css";

export interface MultiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
}

interface SearchableMultiSelectProps {
  readonly label: string;
  readonly placeholder?: string;
  readonly options: readonly MultiSelectOption[];
  readonly selectedOptions: readonly MultiSelectOption[];
  readonly onSelectedOptionsChange: (options: MultiSelectOption[]) => void;
  readonly onSearchTextChange?: (text: string) => void;
  readonly hint?: string;
  readonly isLoading?: boolean;
  readonly tone?: "include" | "exclude";
}

export function SearchableMultiSelect(props: SearchableMultiSelectProps) {
  const { options, selectedOptions, onSelectedOptionsChange } = props;
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputId = useId();
  const listId = `${inputId}-list`;
  const selectedValues = useMemo(() => new Set(selectedOptions.map((option) => option.value)), [selectedOptions]);
  const matchingOptions = useMemo(() => {
    const lowered = searchText.trim().toLowerCase();
    return options.filter((option) => !selectedValues.has(option.value) && (props.onSearchTextChange || !lowered || option.label.toLowerCase().includes(lowered))).slice(0, 40);
  }, [options, searchText, selectedValues, props.onSearchTextChange]);

  function addOption(option: MultiSelectOption) {
    onSelectedOptionsChange([...selectedOptions, option]);
    setSearchText("");
    props.onSearchTextChange?.("");
    setHighlightedIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, matchingOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const option = matchingOptions[highlightedIndex];
      if (option) addOption(option);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    } else if (event.key === "Backspace" && !searchText && selectedOptions.length > 0) {
      onSelectedOptionsChange(selectedOptions.slice(0, -1));
    }
  }

  const highlightedOption = matchingOptions[highlightedIndex];
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {props.label}
      </label>
      <div className={styles.control} onBlur={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setIsOpen(false)}>
        <ul className={styles.chips} aria-label={`Selected ${props.label.toLowerCase()}`}>
          {selectedOptions.map((option) => (
            <li key={option.value} className={props.tone === "exclude" ? `${styles.chip} ${styles.excludeChip}` : styles.chip}>
              {option.label}
              <button type="button" aria-label={`Remove ${option.label}`} onClick={() => onSelectedOptionsChange(selectedOptions.filter((selected) => selected.value !== option.value))}>
                <NanttyIcon name="cancel20" size={12} />
              </button>
            </li>
          ))}
        </ul>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && highlightedOption ? `${listId}-${highlightedOption.value}` : undefined}
          className={styles.input}
          placeholder={props.placeholder ?? "Search"}
          value={searchText}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setSearchText(event.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
            props.onSearchTextChange?.(event.target.value);
          }}
        />
        {isOpen ? (
          <ul id={listId} role="listbox" aria-label={props.label} className={styles.listbox}>
            {props.isLoading ? <li className={styles.message}>Searching…</li> : null}
            {!props.isLoading && matchingOptions.length === 0 ? <li className={styles.message}>No matches</li> : null}
            {matchingOptions.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${option.value}`}
                role="option"
                aria-selected={index === highlightedIndex}
                className={index === highlightedIndex ? `${styles.option} ${styles.highlighted}` : styles.option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addOption(option)}
              >
                <span>{option.label}</span>
                {option.detail ? <span className={styles.detail}>{option.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {props.hint ? <p className={styles.hint}>{props.hint}</p> : null}
    </div>
  );
}
