"use client";

import { useEffect, useRef, useState } from "react";

import chipStyles from "@/components/ui/filterChips.module.css";
import type { Category } from "@/types";

import styles from "./martCategoryBar.module.css";

export interface MartCategoryBarProps {
  readonly categories: readonly Category[];
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
}

const stickyOffset = (element: HTMLElement) => Number.parseFloat(getComputedStyle(element).top) || 0;

export function MartCategoryBar({ categories, selectedCategoryId, onSelectCategory }: MartCategoryBarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!sentinel || !bar) return;
    const offset = Math.ceil(stickyOffset(bar));
    const observer = new IntersectionObserver(
      ([entry]) => setPinned(!!entry && !entry.isIntersecting && entry.boundingClientRect.top <= offset),
      { rootMargin: `-${offset + 1}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    barRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [selectedCategoryId]);

  const select = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!pinned || !sentinel || !bar) return;
    window.scrollTo({ top: sentinel.getBoundingClientRect().top + window.scrollY - stickyOffset(bar) });
  };

  const chip = (id: string | null, label: string, onClick: () => void) => (
    <button
      key={id ?? "all"}
      type="button"
      className={[chipStyles.chip, selectedCategoryId === id ? chipStyles.chipActive : ""].join(" ")}
      aria-pressed={selectedCategoryId === id}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <div ref={barRef} className={[styles.bar, pinned ? styles.pinned : ""].join(" ")}>
        <div className={chipStyles.chipRow} role="group" aria-label="Filter products by category">
          {chip(null, "All", () => select(null))}
          {categories.map((category) => chip(category.id, category.name, () => select(selectedCategoryId === category.id ? null : category.id)))}
        </div>
      </div>
    </>
  );
}
