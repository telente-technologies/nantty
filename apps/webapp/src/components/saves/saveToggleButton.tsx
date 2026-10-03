"use client";

import { BookmarkFilledIcon, BookmarkIcon } from "@/components/ui/icons";
import type { SaveTargetType } from "@/types";

import styles from "./saveToggleButton.module.css";
import { useSaveToggle } from "./useSaveToggle.hook";

interface SaveToggleButtonProps {
  readonly targetType: SaveTargetType;
  readonly targetId: string;
  readonly initiallySaved: boolean;
  readonly appearance?: "inline" | "overlay" | "pill";
  readonly iconSize?: number;
  readonly showLabel?: boolean;
}

export function SaveToggleButton({ targetType, targetId, initiallySaved, appearance = "inline", iconSize = 19, showLabel = false }: SaveToggleButtonProps) {
  const { isSaved, toggleSaved } = useSaveToggle(targetType, targetId, initiallySaved);
  const accessibleLabel = isSaved ? `Remove ${targetType} from saved` : `Save ${targetType}`;
  return (
    <button
      type="button"
      className={[styles.button, styles[appearance], isSaved ? styles.saved : ""].join(" ")}
      aria-pressed={isSaved}
      aria-label={showLabel ? undefined : accessibleLabel}
      title={accessibleLabel}
      onClick={toggleSaved}
    >
      {isSaved ? <BookmarkFilledIcon size={iconSize} /> : <BookmarkIcon size={iconSize} />}
      {showLabel ? <span>{isSaved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
