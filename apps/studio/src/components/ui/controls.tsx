"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/feedback";
import styles from "./controls.module.css";

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
}) {
  return (
    <div className={styles.group} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={[styles.segment, option.value === value ? styles.segmentActive : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function InfiniteSentinel({ label = "Loading more" }: { readonly label?: string }) {
  return (
    <div className={styles.sentinel}>
      <Spinner label={label} size="sm" />
    </div>
  );
}

export function RetryButton({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <button type="button" className={styles.retry} onClick={onRetry}>
      Try again
    </button>
  );
}

export function InlineLink({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Link href={href} className={styles.inlineLink}>
      {children}
    </Link>
  );
}
