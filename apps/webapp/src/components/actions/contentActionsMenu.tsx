"use client";

import { useEffect, useId, useRef, useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MoreIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import type { ReportTargetType, ShareReferenceKind } from "@/services/webActions.service";
import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";

import styles from "./contentActionsMenu.module.css";
import { ReportDialog } from "./reportDialog";
import { ShareToChatDialog } from "./shareToChatDialog";

interface ContentActionsMenuProps {
  readonly shareKind: ShareReferenceKind | null;
  readonly reportTargetType: ReportTargetType;
  readonly targetId: string;
  readonly canonicalPath: string;
  readonly isOwnContent?: boolean;
  readonly triggerClassName?: string;
  readonly onReport?: () => void;
}

export function ContentActionsMenu({ shareKind, reportTargetType, targetId, canonicalPath, isOwnContent = false, triggerClassName, onReport }: ContentActionsMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState<"share" | "report" | null>(null);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  function chooseAction(action: () => void) {
    setIsMenuOpen(false);
    action();
  }

  async function copyLinkToClipboard() {
    try {
      await navigator.clipboard.writeText(buildAbsoluteSiteUrl(canonicalPath));
      showToast({ text: "Link copied" });
    } catch {
      showToast({ text: "Couldn't copy the link", tone: "error" });
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={triggerClassName ?? styles.trigger} aria-label="More options" aria-haspopup="true" aria-expanded={isMenuOpen} aria-controls={menuId} onClick={() => setIsMenuOpen((open) => !open)}>
        <MoreIcon size={20} />
      </button>
      {isMenuOpen ? (
        <div className={styles.menu} id={menuId}>
          {shareKind ? (
            <button type="button" className={styles.item} onClick={() => chooseAction(() => requireAuthThen(() => setOpenDialog("share"), "Sign in to send this in a chat."))}>
              Send in chat
            </button>
          ) : null}
          <button type="button" className={styles.item} onClick={() => chooseAction(() => void copyLinkToClipboard())}>
            Copy link
          </button>
          {isOwnContent ? null : (
            <button type="button" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => requireAuthThen(onReport ?? (() => setOpenDialog("report")), "Sign in to report content."))}>
              Report
            </button>
          )}
        </div>
      ) : null}
      {shareKind ? <ShareToChatDialog isOpen={openDialog === "share"} onClose={() => setOpenDialog(null)} kind={shareKind} referenceId={targetId} /> : null}
      <ReportDialog isOpen={openDialog === "report"} onClose={() => setOpenDialog(null)} targetType={reportTargetType} targetId={targetId} />
    </div>
  );
}
