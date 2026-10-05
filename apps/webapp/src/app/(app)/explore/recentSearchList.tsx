"use client";

import { CloseIcon } from "@/components/ui/icons";
import type { RecentSearchEntry } from "@/types/search.type";

import styles from "./page.module.css";

export interface RecentSearchListProps {
  readonly entries: readonly RecentSearchEntry[];
  readonly onSelect: (query: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
}

export function RecentSearchList({ entries, onSelect, onRemove, onClear }: RecentSearchListProps) {
  if (entries.length === 0) return null;
  return (
    <section className={styles.section} aria-label="Recent searches">
      <div className={styles.recentHeader}>
        <h2 className={styles.sectionTitle}>Recent</h2>
        <button type="button" className={styles.textButton} onClick={onClear}>Clear all</button>
      </div>
      <ul className={styles.entityList}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.recentRow}>
            <button type="button" className={styles.recentQuery} onClick={() => onSelect(entry.query)}>{entry.query}</button>
            <button type="button" className={styles.iconButton} onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.query} from recent searches`}>
              <CloseIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
