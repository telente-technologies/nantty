"use client";

import { useState } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MoreIcon } from "@/components/ui/icons";
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
}

type CopyrightDialogTarget = { readonly targetType: "post" | "clip" | "live" | "sound"; readonly targetId: string };

export function ContentActionsMenu({ shareKind, reportTargetType, targetId, canonicalPath, isOwnContent = false, triggerClassName, onReport, soundId, downloadTarget = null }: ContentActionsMenuProps) {
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
              Send in chat
            </button>
          ) : null}
          <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(() => void copyLinkToClipboard())}>
            Copy link
          </button>
          {downloadTarget ? (
            <button type="button" role="menuitem" className={styles.item} onClick={() => chooseAction(() => requireAuthThen(() => void startDownload(downloadTarget), "Sign in to download."))}>
              Download
            </button>
          ) : null}
          {isOwnContent ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => requireAuthThen(onReport ?? (() => setOpenDialog("report")), "Sign in to report content."))}>
              Report
            </button>
          )}
          {isOwnContent || !canClaimCopyright ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => openCopyrightClaim({ targetType: reportTargetType as "post" | "clip" | "live", targetId }))}>
              Report copyright
            </button>
          )}
          {isOwnContent || !soundId ? null : (
            <button type="button" role="menuitem" className={[styles.item, styles.itemDanger].join(" ")} onClick={() => chooseAction(() => openCopyrightClaim({ targetType: "sound", targetId: soundId }))}>
              Report the sound for copyright
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
