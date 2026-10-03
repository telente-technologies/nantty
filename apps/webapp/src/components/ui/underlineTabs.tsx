"use client";

import { useRef, type KeyboardEvent } from "react";

import styles from "./underlineTabs.module.css";

export interface UnderlineTabOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface UnderlineTabsProps<Value extends string> {
  readonly options: readonly UnderlineTabOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly label: string;
  readonly panelId: string;
}

export function UnderlineTabs<Value extends string>({ options, value, onChange, label, panelId }: UnderlineTabsProps<Value>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocusWithArrowKeys(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = options.findIndex((option) => option.value === value);
    const offsetByKey: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const targetIndex = event.key === "Home" ? 0 : options.length - 1;
      onChange(options[targetIndex]!.value);
      tabRefs.current[targetIndex]?.focus();
      return;
    }
    const offset = offsetByKey[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const nextIndex = (currentIndex + offset + options.length) % options.length;
    onChange(options[nextIndex]!.value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={styles.tabList} role="tablist" aria-label={label} onKeyDown={moveFocusWithArrowKeys}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={[styles.tab, selected ? styles.tabActive : ""].join(" ")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
