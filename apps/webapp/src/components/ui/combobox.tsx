"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import styles from "./combobox.module.css";
import { ChevronDownIcon } from "./icons";

export interface ComboboxOption {
  readonly id: string;
  readonly name: string;
}

interface ComboboxProps {
  readonly label: string;
  readonly options: readonly ComboboxOption[];
  readonly selectedId: string | null;
  readonly onSelect: (option: ComboboxOption) => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly placeholder?: string;
  readonly error?: string | null;
  readonly required?: boolean;
}

export function Combobox({ label, options, selectedId, onSelect, disabled = false, loading = false, placeholder, error, required }: ComboboxProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const errorId = `${uid}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.name.toLowerCase().includes(needle)) : options;
  }, [options, query]);
  const active = Math.min(activeIndex, Math.max(visible.length - 1, 0));
  const optionId = (index: number) => `${uid}-opt-${index}`;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const choose = (option: ComboboxOption) => {
    onSelect(option);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(visible.findIndex((option) => option.id === selectedId), 0));
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((visible.length + active + step) % Math.max(visible.length, 1));
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(visible.length - 1);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  };

  const placeholderText = loading ? "Loading" : (selected?.name ?? placeholder ?? `Select ${label.toLowerCase()}`);

  return (
    <div className={styles.field} ref={rootRef}>
      <label className={styles.label} htmlFor={`${uid}-input`}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={`${uid}-input`}
          className={[styles.input, selected && !open ? styles.hasValue : ""].filter(Boolean).join(" ")}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-required={required || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || loading}
          placeholder={placeholderText}
          value={open ? query : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setActiveIndex(Math.max(options.findIndex((option) => option.id === selectedId), 0))}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <ChevronDownIcon size={16} className={styles.chevron} />
        {open ? (
          <ul id={listId} ref={listRef} role="listbox" aria-label={label} className={styles.list}>
            {visible.length === 0 ? (
              <li className={styles.empty} role="presentation">
                No matches
              </li>
            ) : (
              visible.map((option, index) => (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.id === selectedId}
                  className={[styles.option, index === active ? styles.optionActive : "", option.id === selectedId ? styles.optionSelected : ""].filter(Boolean).join(" ")}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  onPointerMove={() => setActiveIndex(index)}
                >
                  {option.name}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
