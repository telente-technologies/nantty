"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { liveSafetyService } from "@/services/liveSafety.service";
import type { ID } from "@/types";

import styles from "./liveSafety.module.css";

export function LiveSafetyPanel({ liveId, isActive, isRealtime = false }: { readonly liveId: ID; readonly isActive: boolean; readonly isRealtime?: boolean }) {
  const queryClient = useQueryClient();
  const [appealMessage, setAppealMessage] = useState("");
  const safety = useQuery({ queryKey: ["live-safety", liveId], queryFn: () => liveSafetyService.fetchLiveSafety(liveId), enabled: isActive, refetchInterval: isRealtime ? 30_000 : 5000 });
  const appeal = useMutation({
    mutationFn: () => liveSafetyService.appealLiveSafetyHold(liveId, appealMessage.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-safety", liveId] }),
  });
  const state = safety.data;
  if (!isActive || !state) return null;
  const isPaused = state.state === "paused";

  return (
    <section className={isPaused ? styles.paused : styles.warning} role="alert" aria-live="assertive">
      <div className={styles.heading}>
        <span className={styles.kicker}>{isPaused ? "Paused for viewers" : "Safety warning"}</span>
        <h2 className={styles.title}>{isPaused ? "Your live is paused while our safety team reviews it" : "Check what's on camera"}</h2>
      </div>
      <p className={styles.reason}>{isPaused ? state.hostReason ?? "Our safety team is reviewing your live." : state.warningMessage}</p>
      {isPaused ? (
        <p className={styles.muted}>Viewers see a blurred, paused screen and your camera and microphone are muted until a person reviews the live. Nothing is removed without a human decision.</p>
      ) : null}
      {isPaused && state.appealable ? (
        appeal.isSuccess ? (
          <p className={styles.muted}>Appeal sent. A safety specialist will look at your live first.</p>
        ) : (
          <form
            className={styles.appealForm}
            onSubmit={(event) => {
              event.preventDefault();
              appeal.mutate();
            }}
          >
            <label className={styles.muted} htmlFor={`appeal-${liveId}`}>
              Tell the reviewer why your live follows the guidelines (optional)
            </label>
            <textarea id={`appeal-${liveId}`} className={styles.textarea} maxLength={1000} value={appealMessage} onChange={(event) => setAppealMessage(event.target.value)} />
            {appeal.isError ? <p className={styles.error}>{appeal.error instanceof Error ? appeal.error.message : "Couldn't send your appeal."}</p> : null}
            <Button type="submit" variant="secondary" busy={appeal.isPending}>
              Appeal
            </Button>
          </form>
        )
      ) : null}
    </section>
  );
}
