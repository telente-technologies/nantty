"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AlertIcon, ShieldIcon } from "@/components/ui/icons";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { liveSafetyService } from "@/services/liveSafety.service";
import type { LiveSafetyState } from "@/types";

import styles from "./liveSafety.module.css";

export function LiveSafetyOverlay({ message }: { readonly message?: string }) {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span className={styles.overlayIcon}>
        <ShieldIcon size={26} />
      </span>
      <p className={styles.overlayTitle}>{message || "This live is paused while we review it"}</p>
      <p className={styles.overlayText}>Our safety team is checking this live. It will continue here if it follows our community guidelines.</p>
    </div>
  );
}

export function LiveSafetyHostBanner({ liveId, safety, onAppealed }: { readonly liveId: string; readonly safety: LiveSafetyState; readonly onAppealed: () => void }) {
  const [hasAppealed, setHasAppealed] = useState(false);
  const appeal = useMutation({
    mutationFn: () => liveSafetyService.appealLiveSafetyHold(liveId, ""),
    onSuccess: () => {
      setHasAppealed(true);
      onAppealed();
    },
  });
  const isPaused = safety.state === "paused";
  return (
    <div className={isPaused ? styles.bannerPaused : styles.bannerWarning} role="alert">
      <AlertIcon size={20} />
      <div className={styles.bannerBody}>
        <p className={styles.bannerTitle}>{isPaused ? "Your live is paused for viewers" : "Check what's on camera"}</p>
        <p className={styles.bannerText}>{isPaused ? safety.hostReason ?? "Our safety team is reviewing your live." : safety.warningMessage}</p>
        {appeal.isError ? <p className={styles.bannerText}>{readErrorMessageForDisplay(appeal.error)}</p> : null}
      </div>
      {isPaused && safety.appealable ? (
        <Button size="sm" variant="secondary" onClick={() => appeal.mutate()} disabled={hasAppealed} busy={appeal.isPending}>
          {hasAppealed ? "Appeal sent" : "Appeal"}
        </Button>
      ) : null}
    </div>
  );
}
