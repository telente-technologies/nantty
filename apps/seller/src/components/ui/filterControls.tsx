"use client";

import { useEffect, useState } from "react";

import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { buildDateRangeEndingToday } from "@/utils/dateFormatting.util";

import styles from "./filterControls.module.css";

export function SearchInput({ label, placeholder, value, onValueChange, debounceMilliseconds = 250 }: { readonly label: string; readonly placeholder?: string; readonly value: string; readonly onValueChange: (value: string) => void; readonly debounceMilliseconds?: number }) {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);
  useEffect(() => {
    if (draftValue === value) return;
    const timeoutHandle = window.setTimeout(() => onValueChange(draftValue), debounceMilliseconds);
    return () => window.clearTimeout(timeoutHandle);
  }, [draftValue, value, onValueChange, debounceMilliseconds]);
  return (
    <label className={styles.search}>
      <NanttyIcon name="magnifyingGlass20" size={16} />
      <span className="visuallyHidden">{label}</span>
      <input type="search" value={draftValue} placeholder={placeholder ?? label} onChange={(event) => setDraftValue(event.target.value)} className={styles.searchInput} maxLength={120} />
    </label>
  );
}

export interface DateRangeValue {
  readonly from: string;
  readonly to: string;
}

const dateRangePresets = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
];

export function DateRangeControl({ value, onValueChange }: { readonly value: DateRangeValue; readonly onValueChange: (value: DateRangeValue) => void }) {
  return (
    <div className={styles.dateRange} role="group" aria-label="Date range">
      <div className={styles.presets}>
        {dateRangePresets.map((preset) => {
          const presetRange = buildDateRangeEndingToday(preset.days);
          const isActive = presetRange.from === value.from && presetRange.to === value.to;
          return (
            <button key={preset.label} type="button" className={styles.preset} aria-pressed={isActive} onClick={() => onValueChange(presetRange)}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <label className={styles.dateInputLabel}>
        <span className="visuallyHidden">From</span>
        <input type="date" value={value.from} max={value.to} onChange={(event) => event.target.value && onValueChange({ ...value, from: event.target.value })} className={styles.dateInput} />
      </label>
      <span aria-hidden="true">–</span>
      <label className={styles.dateInputLabel}>
        <span className="visuallyHidden">To</span>
        <input type="date" value={value.to} min={value.from} onChange={(event) => event.target.value && onValueChange({ ...value, to: event.target.value })} className={styles.dateInput} />
      </label>
    </div>
  );
}

export function FilterBar({ children }: { readonly children: React.ReactNode }) {
  return <div className={styles.filterBar}>{children}</div>;
}
