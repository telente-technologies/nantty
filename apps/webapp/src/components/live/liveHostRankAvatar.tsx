"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Avatar } from "@/components/ui/media";
import type { LiveHostRanking } from "@/types";
import { describeHostRanking, formatRankChip, isUsableHostRanking, tierForRank } from "@/utils/liveHostRank.util";

import styles from "./liveHostRankAvatar.module.css";

export interface LiveHostRankAvatarProps {
  readonly hostName: string;
  readonly avatarUrl: string | null | undefined;
  readonly ranking: LiveHostRanking | null | undefined;
}

export function LiveHostRankAvatar({ hostName, avatarUrl, ranking }: LiveHostRankAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!isUsableHostRanking(ranking)) return <Avatar name={hostName} src={avatarUrl} size="md" />;
  const tier = tierForRank(ranking.globalRank);
  const description = describeHostRanking(ranking);
  return (
    <span ref={containerRef} className={styles.anchor}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.ring, styles[tier]].join(" ")}
        aria-label={`${hostName} is ${description.label}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Avatar name={hostName} src={avatarUrl} size="md" />
        <span className={styles.chip} aria-hidden="true">
          {formatRankChip(ranking.globalRank)}
        </span>
      </button>
      {isOpen ? (
        <span id={popoverId} role="dialog" aria-label={`${hostName}'s ranking`} className={styles.popover}>
          <span className={styles.row}>
            <AppIcon name={ranking.globalRank <= 3 ? "crown24" : "globe24"} size={18} />
            {description.globalLine}
          </span>
          {description.categoryLine ? (
            <span className={styles.row}>
              <AppIcon name="trophy24" size={18} />
              {description.categoryLine}
            </span>
          ) : null}
          <span className={styles.note}>Streamer rank from ZudoPoints earned on lives.</span>
        </span>
      ) : null}
    </span>
  );
}
