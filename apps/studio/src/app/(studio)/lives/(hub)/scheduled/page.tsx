"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestConfirmation } from "@nantty/web-kit";

import { LiveDetailsFields, useLiveDetails, type LiveDetailsValue } from "@/components/golive/liveDetailsFields";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListPageSkeleton } from "@/components/ui/pageSkeletons";
import { LIVE_CATEGORY_LABELS } from "@/constants/liveCategories.constant";
import { livesService } from "@/services/lives.service";
import { studioLiveService } from "@/services/studioLive.service";
import type { LiveSession } from "@/types";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";
import { describeTimeUntil, formatScheduleTime, MAXIMUM_SCHEDULE_DAYS, MINIMUM_LEAD_MINUTES, toLocalInputValue, validateScheduleTime } from "@/utils/schedule.util";

import styles from "../hub.module.css";

const inputBounds = () => ({
  min: toLocalInputValue(new Date(Date.now() + MINIMUM_LEAD_MINUTES * 60_000)),
  max: toLocalInputValue(new Date(Date.now() + MAXIMUM_SCHEDULE_DAYS * 86_400_000)),
});

export default function ScheduledLivesPage() {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<LiveDetailsValue>({ title: "", category: "justChatting", storeId: null });
  const [when, setWhen] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduledMessage, setScheduledMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const resolved = useLiveDetails(details);
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const scheduled = (lives.data ?? []).filter((live) => live.state === "idle" && live.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));

  const schedule = useMutation({
    mutationFn: (scheduledAt: string) => studioLiveService.scheduleLive({ title: resolved.title, category: resolved.category, scheduledAt, storeId: resolved.storeId || null }),
    onSuccess: (live) => {
      setDetails({ title: "", category: "justChatting", storeId: null });
      setWhen("");
      setScheduledMessage(`Scheduled "${live.title}". Followers get a reminder shortly before it starts.`);
      void queryClient.invalidateQueries({ queryKey: ["lives"] });
    },
    onError: (error: Error) => setFormError(readLiveErrorMessage(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setScheduledMessage(null);
    const checked = validateScheduleTime(when);
    setTimeError(checked.error);
    if (!checked.date || inFlight.current) return;
    inFlight.current = true;
    schedule.mutate(checked.date.toISOString(), { onSettled: () => { inFlight.current = false; } });
  }

  if (lives.isLoading) return <ListPageSkeleton label="Loading scheduled lives" />;
  const bounds = inputBounds();

  return (
    <>
      <form className={styles.formCard} onSubmit={submit} aria-labelledby="schedule-heading" noValidate>
        <h2 className={styles.sectionTitle} id="schedule-heading">Schedule a live</h2>
        <LiveDetailsFields value={details} onChange={setDetails} />
        <TextField label="Date and time" type="datetime-local" required min={bounds.min} max={bounds.max} value={when} error={timeError} hint={`Your local time. At least ${MINIMUM_LEAD_MINUTES} minutes from now, up to ${MAXIMUM_SCHEDULE_DAYS} days ahead.`} onChange={(event) => setWhen(event.target.value)} />
        <div>
          <Button type="submit" busy={schedule.isPending}>Schedule live</Button>
        </div>
        {formError ? <p className={styles.formError} role="alert">{formError}</p> : null}
        {scheduledMessage ? <p className={styles.muted} role="status">{scheduledMessage}</p> : null}
      </form>

      {lives.isError ? <ErrorState title="We couldn't load your scheduled lives" error={lives.error} onRetry={() => void lives.refetch()} /> : null}

      <section className={styles.section} aria-labelledby="upcoming-heading">
        <h2 className={styles.sectionTitle} id="upcoming-heading">Upcoming</h2>
        {lives.isSuccess && scheduled.length === 0 ? (
          <EmptyState title="No lives scheduled" description="Scheduled lives appear on your profile so followers can plan to join, and they get a reminder before you start." />
        ) : (
          <ul className={styles.list}>
            {scheduled.map((live) => <ScheduledRow key={live.id} live={live} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function ScheduledRow({ live }: { readonly live: LiveSession }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(live.title);
  const [when, setWhen] = useState(live.scheduledAt ? toLocalInputValue(new Date(live.scheduledAt)) : "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["lives"] });
  const edit = useMutation({
    mutationFn: (scheduledAt: string) => studioLiveService.editLive(live.id, { title: title.trim(), scheduledAt }),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const cancel = useMutation({ mutationFn: () => studioLiveService.cancelLive(live.id), onSuccess: refresh });
  const failure = edit.error ?? cancel.error;

  async function confirmCancel() {
    const confirmed = await requestConfirmation({ title: "Cancel this live?", description: "It's removed from your schedule and followers won't get a reminder. This can't be undone.", confirmLabel: "Cancel live", cancelLabel: "Keep it", tone: "danger" });
    if (confirmed && !cancel.isPending) cancel.mutate();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateScheduleTime(when);
    setTimeError(checked.error);
    if (!title.trim()) return;
    if (checked.date && !edit.isPending) edit.mutate(checked.date.toISOString());
  }

  const bounds = inputBounds();

  return (
    <li className={styles.rowStack}>
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <div className={styles.rowTitleRow}>
            <span className={`${styles.stateBadge} ${styles.state_idle}`}>{live.scheduledAt ? describeTimeUntil(live.scheduledAt) : "Scheduled"}</span>
            <span className={styles.rowTitle}>{live.title}</span>
          </div>
          <p className={styles.rowMeta}>{live.scheduledAt ? formatScheduleTime(live.scheduledAt) : ""} · {LIVE_CATEGORY_LABELS[live.category]}</p>
        </div>
        <div className={styles.rowActions}>
          <Link href={`/lives/${live.id}`} className={styles.rowLink} aria-label={`Go live now with ${live.title}`}>Go live now</Link>
          <Button variant="ghost" size="sm" aria-expanded={editing} onClick={() => setEditing((value) => !value)}>{editing ? "Close" : "Edit"}</Button>
          <Button variant="ghost" size="sm" busy={cancel.isPending} onClick={() => void confirmCancel()}>Cancel</Button>
        </div>
      </div>
      {editing ? (
        <form className={styles.inlineForm} onSubmit={save} noValidate aria-label={`Edit ${live.title}`}>
          <TextField label="Title" value={title} maxLength={140} error={title.trim() ? null : "Add a title."} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Date and time" type="datetime-local" min={bounds.min} max={bounds.max} value={when} error={timeError} onChange={(event) => setWhen(event.target.value)} />
          <div>
            <Button type="submit" busy={edit.isPending}>Save changes</Button>
          </div>
        </form>
      ) : null}
      {failure ? <p className={styles.formError} role="alert">{readLiveErrorMessage(failure)}</p> : null}
    </li>
  );
}
