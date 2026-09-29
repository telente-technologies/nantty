"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./columnPicker.module.css";

interface ColumnPickerProps {
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly visibleKeys: readonly string[];
  readonly onVisibleKeysChange: (keys: string[]) => void;
}

export function ColumnPicker({ columns, visibleKeys, onVisibleKeysChange }: ColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const closeWhenClickingOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function toggleColumn(key: string) {
    onVisibleKeysChange(visibleKeys.includes(key) ? visibleKeys.filter((visibleKey) => visibleKey !== key) : [...visibleKeys, key]);
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <Button size="small" iconName="slidersHorizontal24" aria-expanded={isOpen} aria-haspopup="true" onClick={() => setIsOpen((current) => !current)}>
        Columns
      </Button>
      {isOpen ? (
        <fieldset className={styles.menu}>
          <legend className="visuallyHidden">Visible columns</legend>
          {columns.map((column) => (
            <label key={column.key} className={styles.option}>
              <input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} />
              {column.label}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
