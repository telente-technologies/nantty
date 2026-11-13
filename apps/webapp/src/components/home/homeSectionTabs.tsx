"use client";

import type { CSSProperties, KeyboardEvent } from "react";

import { homeSections, sectionIndexOf } from "@/utils/homeSectionSwipe.util";

import { useHomeSection } from "./homeSection.context";
import styles from "./homeSectionTabs.module.css";

const sectionLabels = { feed: "Feed", mart: "Mart" } as const;

export function HomeSectionTabs({ compact = false, desktopOnly = false, idPrefix = "home-section" }: { readonly compact?: boolean; readonly desktopOnly?: boolean; readonly idPrefix?: string }) {
  const { activeSection, selectSection } = useHomeSection();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = Math.min(homeSections.length - 1, Math.max(0, sectionIndexOf(activeSection) + (event.key === "ArrowRight" ? 1 : -1)));
    const nextSection = homeSections[nextIndex] ?? activeSection;
    selectSection(nextSection);
    document.getElementById(`${idPrefix}-tab-${nextSection}`)?.focus();
  };

  return (
    <div
      className={[styles.tabs, compact ? styles.compact : "", desktopOnly ? styles.desktopOnly : ""].filter(Boolean).join(" ")}
      role="tablist"
      aria-label="Home sections"
      onKeyDown={onKeyDown}
      style={{ "--tab-active-index": sectionIndexOf(activeSection) } as CSSProperties}
    >
      {homeSections.map((section, index) => (
        <button
          key={section}
          id={`${idPrefix}-tab-${section}`}
          type="button"
          role="tab"
          aria-selected={activeSection === section}
          aria-controls={`home-section-panel-${section}`}
          tabIndex={activeSection === section ? 0 : -1}
          className={styles.tab}
          style={{ "--tab-index": index } as CSSProperties}
          onClick={() => selectSection(section)}
        >
          <span className={styles.label}>{sectionLabels[section]}</span>
          <span className={styles.labelActive} aria-hidden="true">{sectionLabels[section]}</span>
        </button>
      ))}
    </div>
  );
}
