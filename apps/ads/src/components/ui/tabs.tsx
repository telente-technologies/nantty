"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";

import styles from "./tabs.module.css";

interface TabItem<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly count?: number;
}

export function TabList<Value extends string>({ label, tabs, selected, onSelect }: { readonly label: string; readonly tabs: readonly TabItem<Value>[]; readonly selected: Value; readonly onSelect: (value: Value) => void }) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  function moveFocusWithArrowKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const currentIndex = tabs.findIndex((tab) => tab.value === selected);
    const nextIndex = (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (!nextTab) return;
    onSelect(nextTab.value);
    tabRefs.current[nextIndex]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={styles.tabList} onKeyDown={moveFocusWithArrowKeys}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          type="button"
          role="tab"
          aria-selected={tab.value === selected}
          tabIndex={tab.value === selected ? 0 : -1}
          className={tab.value === selected ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onSelect(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className={styles.count}>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function LinkTabs({ label, links }: { readonly label: string; readonly links: readonly { readonly href: string; readonly label: string; readonly exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={styles.tabList}>
      {links.map((link) => {
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} aria-current={isActive ? "page" : undefined} className={isActive ? `${styles.tab} ${styles.active}` : styles.tab}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
