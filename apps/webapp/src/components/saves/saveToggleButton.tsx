"use client";

import { BookmarkActionIcon, BookmarkFilledActionIcon } from "@/components/ui/icons";
import type { SaveTargetType } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import styles from "./saveToggleButton.module.css";
import { useSaveToggle } from "./useSaveToggle.hook";

interface SaveToggleButtonProps {
  readonly targetType: SaveTargetType;
  readonly targetId: string;
  readonly initiallySaved: boolean;
  readonly appearance?: "inline" | "overlay" | "pill";
  readonly iconSize?: number;
  readonly saveCount?: number;
}

export function SaveToggleButton({ targetType, targetId, initiallySaved, appearance = "inline", iconSize = 19, saveCount }: SaveToggleButtonProps) {
  const { isSaved, toggleSaved } = useSaveToggle(targetType, targetId, initiallySaved);
  const accessibleLabel = isSaved ? `Remove ${targetType} from saved` : `Save ${targetType}`;
  return (
    <button
      type="button"
      className={[styles.button, styles[appearance], isSaved ? styles.saved : ""].join(" ")}
      aria-pressed={isSaved}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={toggleSaved}
    >
      {isSaved ? <BookmarkFilledActionIcon size={iconSize} /> : <BookmarkActionIcon size={iconSize} />}
      {saveCount !== undefined ? <span>{formatCountWithThousandsSuffix(Math.max(saveCount + (isSaved === initiallySaved ? 0 : isSaved ? 1 : -1), 0))}</span> : null}
    </button>
  );
}
