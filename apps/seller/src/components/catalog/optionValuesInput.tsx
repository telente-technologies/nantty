"use client";

import { useId, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";

import { addOptionValues, moveOptionValue, productOptionLimits } from "@/components/catalog/productOptions.util";
import { Button } from "@/components/ui/button";
import { NanttyIcon } from "@/components/ui/nanttyIcon";

import styles from "./productOptions.module.css";

interface OptionValuesInputProps {
  readonly optionName: string;
  readonly values: readonly string[];
  readonly pendingText: string;
  readonly errorMessage?: string;
  readonly autoFocus?: boolean;
  readonly onChange: (patch: { values?: string[]; pendingText?: string }) => void;
  readonly onRemoveValue: (value: string) => void;
  readonly onAnnounce: (message: string) => void;
}

const separator = /[,\n;\t]/;

export function placeholderForOptionName(optionName: string): string {
  const name = optionName.trim().toLocaleLowerCase();
  if (name.startsWith("size")) return "e.g. M, then press Enter";
  if (name.startsWith("colo")) return "e.g. Red, then press Enter";
  if (name.startsWith("storage")) return "e.g. 128GB, then press Enter";
  if (name.startsWith("material")) return "e.g. Cotton, then press Enter";
  return "Type a value, then press Enter";
}

export function OptionValuesInput({ optionName, values, pendingText, errorMessage, autoFocus, onChange, onRemoveValue, onAnnounce }: OptionValuesInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ values, pendingText });
  latest.current = { values, pendingText };
  const [localError, setLocalError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const label = optionName.trim().toLocaleLowerCase() || "option";
  const atCap = values.length >= productOptionLimits.maxValuesPerGroup;
  const shownError = localError ?? errorMessage ?? null;

  function commit(text: string, keepText = "") {
    if (text.trim().length === 0) {
      if (latest.current.pendingText === keepText) return;
      latest.current = { ...latest.current, pendingText: keepText };
      onChange({ pendingText: keepText });
      return;
    }
    const result = addOptionValues(latest.current.values, text);
    setLocalError(result.error);
    const leftover = result.added.length === 0 ? text : keepText;
    latest.current = { values: result.values, pendingText: leftover };
    onChange({ values: result.values, pendingText: leftover });
    if (result.added.length > 0) onAnnounce(result.added.length === 1 ? `Added ${result.added[0]}.` : `Added ${result.added.length} values.`);
    inputRef.current?.focus();
  }

  function handleTextChange(text: string) {
    setLocalError(null);
    if (!separator.test(text)) {
      latest.current = { ...latest.current, pendingText: text };
      onChange({ pendingText: text });
      return;
    }
    const parts = text.split(separator);
    const keep = parts.pop() ?? "";
    commit(parts.join(","), keep.trimStart());
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!separator.test(pasted)) return;
    event.preventDefault();
    commit(`${latest.current.pendingText},${pasted}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    commit(latest.current.pendingText);
  }

  function move(index: number, target: number) {
    if (target < 0 || target >= values.length || target === index) return;
    onChange({ values: moveOptionValue(values, index, target) });
    onAnnounce(`${values[index]} moved to position ${target + 1} of ${values.length}.`);
  }

  function handleHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    move(index, index + delta);
    const target = event.currentTarget.closest("ul")?.querySelectorAll<HTMLButtonElement>("[data-chip-handle]")[index + delta];
    requestAnimationFrame(() => target?.focus());
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault();
    if (draggedIndex !== null) move(draggedIndex, index);
    setDraggedIndex(null);
  }

  const canAdd = pendingText.trim().length > 0 && !atCap;
  const describedBy = `${inputId}-help`;

  return (
    <div className={styles.valuesField}>
      <label htmlFor={inputId} className={styles.valuesLabel}>{optionName.trim() ? `${optionName.trim()} values` : "Values"}</label>
      {values.length > 0 ? (
        <ul className={styles.chipList} aria-label={`${optionName.trim() || "Option"} values`}>
          {values.map((value, index) => (
            <li
              key={value}
              className={[styles.chip, draggedIndex === index ? styles.chipDragging : ""].join(" ")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, index)}
            >
              <button
                type="button"
                data-chip-handle
                className={styles.chipHandle}
                draggable
                aria-label={`Reorder ${value}, ${index + 1} of ${values.length}`}
                aria-describedby={`${inputId}-reorder`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", value);
                  setDraggedIndex(index);
                }}
                onDragEnd={() => setDraggedIndex(null)}
                onKeyDown={(event) => handleHandleKeyDown(event, index)}
              >
                <NanttyIcon name="dotsSixVertical16" size={14} />
              </button>
              <span className={styles.chipText}>{value}</span>
              <button type="button" className={styles.chipRemove} aria-label={`Remove ${value}`} title={`Remove ${value}`} onClick={() => onRemoveValue(value)}>
                <NanttyIcon name="cancel20" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span id={`${inputId}-reorder`} className="visuallyHidden">Drag, or use the arrow keys, to change the order.</span>
      <div className={[styles.addRow, shownError ? styles.addRowInvalid : ""].join(" ")}>
        <input
          ref={inputRef}
          id={inputId}
          className={styles.addInput}
          value={pendingText}
          placeholder={atCap ? `Up to ${productOptionLimits.maxValuesPerGroup} values` : placeholderForOptionName(optionName)}
          disabled={atCap}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleTextChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
        />
        <Button size="small" iconName="plus16" disabled={!canAdd} aria-label={`Add ${label} value`} onClick={() => commit(latest.current.pendingText)}>Add</Button>
      </div>
      <p id={describedBy} className={shownError ? styles.valuesError : styles.valuesHint} aria-live="polite">
        {shownError ?? (values.length === 0 ? "Press Enter after each value. You can paste a list like S, M, L." : `${values.length} of ${productOptionLimits.maxValuesPerGroup} values.`)}
      </p>
    </div>
  );
}
