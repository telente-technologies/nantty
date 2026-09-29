"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./navigationTabs.module.css";

export function LinkTabs({ label, tabs }: { readonly label: string; readonly tabs: readonly { readonly href: string; readonly label: string; readonly exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={styles.tabList}>
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={isActive ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SegmentedControl<Value extends string>({ label, options, value, onValueChange }: { readonly label: string; readonly options: readonly { readonly value: Value; readonly label: string }[]; readonly value: Value; readonly onValueChange: (value: Value) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={styles.segment} onClick={() => onValueChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
