"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./tabs.module.css";

export interface TabItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly count?: number | null;
}

export function SegmentedTabs<Key extends string>({ items, activeKey, onChange, label }: { readonly items: readonly TabItem<Key>[]; readonly activeKey: Key; readonly onChange: (key: Key) => void; readonly label: string }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.key} type="button" role="tab" aria-selected={item.key === activeKey} className={item.key === activeKey ? `${styles.tab} ${styles.active}` : styles.tab} onClick={() => onChange(item.key)}>
          {item.label}
          {item.count !== undefined && item.count !== null ? <span className={styles.count}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function LinkTabs({ items, label }: { readonly items: readonly { readonly href: string; readonly label: string }[]; readonly label: string }) {
  const pathname = usePathname();
  return (
    <nav className={styles.tabs} aria-label={label}>
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={isActive ? `${styles.tab} ${styles.active}` : styles.tab} aria-current={isActive ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
