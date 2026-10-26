"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PlayIcon, TrashIcon } from "@/components/ui/icons";
import { ListPageSkeleton } from "@/components/ui/pageSkeletons";
import { LIVE_CATEGORY_LABELS } from "@/constants/liveCategories.constant";
import { livesService } from "@/services/lives.service";
import { studioLiveService } from "@/services/studioLive.service";
import type { LiveSession } from "@/types";
import type { LiveRecording } from "@/types/studioLive.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";
import { formatScheduleTime } from "@/utils/schedule.util";

import styles from "../hub.module.css";

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${Math.max(1, minutes)} min`;
};

const formatSize = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);

const RECORDING_STATE: Record<LiveRecording["state"], { readonly label: string; readonly tone: "success" | "warning" | "error" }> = {
  completed: { label: "Ready", tone: "success" },
  recording: { label: "Saving", tone: "warning" },
  failed: { label: "Failed", tone: "error" },
};

export default function ReplaysPage() {
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const past = (lives.data ?? [])
    .filter((live) => live.state === "ended" && live.startedAt !== null)
    .sort((a, b) => (b.endedAt ?? b.startedAt ?? "").localeCompare(a.endedAt ?? a.startedAt ?? ""));

  if (lives.isLoading) return <ListPageSkeleton label="Loading past lives" />;
  if (lives.isError) return <ErrorState title="We couldn't load your past lives" error={lives.error} onRetry={() => void lives.refetch()} />;

  return (
    <section className={styles.section} aria-labelledby="replays-heading">
      <h2 className={styles.sectionTitle} id="replays-heading">Past lives</h2>
      <p className={styles.muted}>Only lives you recorded have a replay. Turn on recording from the control room before or during a live.</p>
      {past.length === 0 ? (
        <EmptyState title="No past lives yet" description="When you end a live it shows up here with its stats, and its replay if you recorded it." action={<Link href="/lives" className={styles.rowLink}>Go live</Link>} />
      ) : (
        <ul className={styles.list}>
          {past.map((live) => <ReplayRow key={live.id} live={live} />)}
        </ul>
      )}
    </section>
  );
}

function ReplayRow({ live }: { readonly live: LiveSession }) {
  const [open, setOpen] = useState(false);
  const panelId = `replay-${live.id}`;
  const endedAt = live.endedAt ?? live.startedAt;
  return (
    <li className={styles.rowStack}>
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowTitleRow}>
            <span className={`${styles.stateBadge} ${styles.state_ended}`}>Ended</span>
            <span className={styles.rowTitle}>{live.title}</span>
          </div>
          <p className={styles.rowMeta}>
            {endedAt ? formatScheduleTime(endedAt) : ""} · {LIVE_CATEGORY_LABELS[live.category]} · {`${formatCountWithThousandsSuffix(live.peakViewers)} peak viewers`} · {`${formatCountWithThousandsSuffix(live.earnings.coins)} coins`}
          </p>
        </div>
        <div className={styles.rowActions}>
          <Button variant="secondary" size="sm" leadingIcon={<PlayIcon size={16} />} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide replays" : "Replays"}
          </Button>
        </div>
      </div>
      {open ? <RecordingsPanel id={panelId} live={live} /> : null}
    </li>
  );
}

function RecordingsPanel({ id, live }: { readonly id: string; readonly live: LiveSession }) {
  const queryClient = useQueryClient();
  const queryKey = ["recordings", live.id];
  const recordings = useQuery({ queryKey, queryFn: () => studioLiveService.listRecordings(live.id) });
  const remove = useMutation({
    mutationFn: (recordingId: string) => studioLiveService.deleteRecording(live.id, recordingId),
    onSuccess: (_result, recordingId) => queryClient.setQueryData<LiveRecording[]>(queryKey, (current) => (current ?? []).filter((recording) => recording.id !== recordingId)),
    onError: () => void queryClient.invalidateQueries({ queryKey }),
  });

  async function confirmDelete(recording: LiveRecording) {
    if (remove.isPending) return;
    const confirmed = await requestConfirmation({ title: "Delete this replay?", description: "The video file is removed for good and can't be recovered. Your live's stats and earnings stay.", confirmLabel: "Delete replay", cancelLabel: "Keep it", tone: "danger" });
    if (confirmed) remove.mutate(recording.id);
  }

  return (
    <div className={styles.rowExtra} id={id}>
      {recordings.isLoading ? <Skeleton height={96} /> : null}
      {recordings.isError ? <ErrorState title="Replays didn't load" error={recordings.error} onRetry={() => void recordings.refetch()} /> : null}
      {recordings.isSuccess && recordings.data.length === 0 ? <p className={styles.muted}>This live wasn't recorded, so there's no replay.</p> : null}
      {recordings.data && recordings.data.length > 0 ? (
        <ul className={styles.recordingList}>
          {recordings.data.map((recording, index) => {
            const state = RECORDING_STATE[recording.state];
            const label = `Recording ${index + 1}`;
            return (
              <li key={recording.id} className={styles.recording}>
                <div className={styles.recordingHead}>
                  <span className={styles.rowTitleRow}>
                    <strong>{label}</strong>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {recording.state === "completed" ? <span className={styles.rowMeta}>{`${formatDuration(recording.durationSeconds)} · ${formatSize(recording.sizeBytes)}`}</span> : null}
                  </span>
                  {recording.state !== "recording" ? (
                    <Button variant="ghost" size="sm" leadingIcon={<TrashIcon size={16} />} busy={remove.isPending && remove.variables === recording.id} onClick={() => void confirmDelete(recording)} aria-label={`Delete ${label} of ${live.title}`}>
                      Delete
                    </Button>
                  ) : null}
                </div>
                {recording.state === "completed" && recording.playbackUrl ? (
                  <video className={styles.player} src={recording.playbackUrl} controls preload="metadata" aria-label={`${label} of ${live.title}`} />
                ) : null}
                {recording.state === "failed" ? <p className={styles.muted}>This recording couldn't be saved. You can delete it.</p> : null}
                {recording.state === "recording" ? <p className={styles.muted}>Still saving. It'll be ready a few minutes after the live ends.</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {remove.isError ? <p className={styles.formError} role="alert">{readLiveErrorMessage(remove.error)}</p> : null}
    </div>
  );
}
