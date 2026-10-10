"use client";

import { useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { CopyrightIcon, DownloadIcon, FlagIcon, LinkIcon, MoreIcon, PinIcon, SendActionIcon } from "@/components/ui/icons";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import { showToast } from "@/components/ui/toast";
import type { ReportTargetType, ShareReferenceKind } from "@/services/webActions.service";
import type { DownloadTarget } from "@/types";
import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";

import styles from "./contentActionsMenu.module.css";
import { CopyrightClaimDialog } from "@/components/copyright/copyrightClaimDialog";

import { useBrandedMediaDownload } from "./brandedMediaDownload.hook";
import { MediaDownloadProgress } from "./mediaDownloadProgress";
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
  readonly soundId?: string | null;
  readonly downloadTarget?: DownloadTarget | null;
  readonly pinAction?: { readonly pinned: boolean; readonly onTogglePin: () => void; readonly disabled?: boolean };
}

type CopyrightDialogTarget = { readonly targetType: "post" | "clip" | "live" | "sound"; readonly targetId: string };

export function ContentActionsMenu({ shareKind, reportTargetType, targetId, canonicalPath, isOwnContent = false, triggerClassName, onReport, soundId, downloadTarget = null, pinAction }: ContentActionsMenuProps) {
  const { activeDownload, startDownload, cancelDownload } = useBrandedMediaDownload();
  const { isOpen: menuIsOpen, close: menuClose, containerRef: menuContainerRef, triggerRef: menuTriggerRef, menuRef: menuMenuRef, triggerProps: menuTriggerProps, menuProps: menuMenuProps } = usePopoverMenu();
  const [copyrightTarget, setCopyrightTarget] = useState<CopyrightDialogTarget | null>(null);
  const canClaimCopyright = reportTargetType === "post" || reportTargetType === "clip" || reportTargetType === "live";
  const openCopyrightClaim = (target: CopyrightDialogTarget) => requireAuthThen(() => setCopyrightTarget(target), "Sign in to file a copyright claim.");
  const [openDialog, setOpenDialog] = useState<"share" | "report" | null>(null);
  function chooseAction(action: () => void) {
    menuClose(true);
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
    <div className={styles.container} ref={menuContainerRef}>
      <button type="button" className={triggerClassName ?? styles.trigger} aria-label="More options" ref={menuTriggerRef} {...menuTriggerProps}>
        <MoreIcon size={20} />
      </button>
      {menuIsOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => menuClose()} /> : null}
      {menuIsOpen ? (
        <div className={[styles.menu, sheetStyles.sheet].join(" ")} aria-label="More options" ref={menuMenuRef} {...menuMenuProps}>
          {shareKind ? (
            <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(() => requireAuthThen(() => setOpenDialog("share"), "Sign in to send this in a chat."))}>
              <SendActionIcon size={18} aria-hidden="true" />
              <span>Send in chat</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(() => void copyLinkToClipboard())}>
            <LinkIcon size={18} aria-hidden="true" />
            <span>Copy link</span>
          </button>
          {downloadTarget ? (
            <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(() => requireAuthThen(() => void startDownload(downloadTarget), "Sign in to download."))}>
              <DownloadIcon size={18} aria-hidden="true" />
              <span>Download</span>
            </button>
          ) : null}
          {isOwnContent && pinAction ? (
            <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(pinAction.onTogglePin)} disabled={pinAction.disabled}>
              <PinIcon size={18} aria-hidden="true" />
              <span>{pinAction.pinned ? "Unpin from profile" : "Pin to profile"}</span>
            </button>
          ) : null}
          {isOwnContent ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => requireAuthThen(onReport ?? (() => setOpenDialog("report")), "Sign in to report content."))}>
              <FlagIcon size={18} aria-hidden="true" />
              <span>Report</span>
            </button>
          )}
          {isOwnContent || !canClaimCopyright ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => openCopyrightClaim({ targetType: reportTargetType as "post" | "clip" | "live", targetId }))}>
              <CopyrightIcon size={18} aria-hidden="true" />
              <span>Report copyright</span>
            </button>
          )}
          {isOwnContent || !soundId ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => openCopyrightClaim({ targetType: "sound", targetId: soundId }))}>
              <CopyrightIcon size={18} aria-hidden="true" />
              <span>Report the sound for copyright</span>
            </button>
          )}
        </div>
      ) : null}
      {shareKind ? <ShareToChatDialog isOpen={openDialog === "share"} onClose={() => setOpenDialog(null)} kind={shareKind} referenceId={targetId} /> : null}
      {copyrightTarget ? <CopyrightClaimDialog isOpen onClose={() => setCopyrightTarget(null)} targetType={copyrightTarget.targetType} targetId={copyrightTarget.targetId} /> : null}
      {activeDownload ? <MediaDownloadProgress download={activeDownload} onCancel={cancelDownload} /> : null}
      <ReportDialog isOpen={openDialog === "report"} onClose={() => setOpenDialog(null)} targetType={reportTargetType} targetId={targetId} />
    </div>
  );
}
