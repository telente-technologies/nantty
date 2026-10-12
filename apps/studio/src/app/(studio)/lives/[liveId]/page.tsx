"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { BrowserBroadcaster } from "@/components/golive/browserBroadcaster";
import { EncoderSetupCard } from "@/components/golive/encoderSetupCard";
import { LiveChatSettingsCard } from "@/components/golive/liveChatSettingsCard";
import { LiveControlColumns } from "@/components/golive/liveControlColumns";
import { StreamHealthPanel } from "@/components/golive/streamHealthPanel";
import { useControlRoomRealtime } from "@/components/live/controlRoomRealtime.hook";
import { LiveEarningsPanel } from "@/components/live/liveEarningsPanel";
import { LiveSafetyPanel } from "@/components/live/liveSafetyPanel";
import { StageGuestsPanel } from "@/components/live/stageGuestsPanel";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { RetryButton, SegmentedControl } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ControlRoomSkeleton } from "@/components/ui/pageSkeletons";
import { LIVE_CATEGORY_LABELS } from "@/constants/liveCategories.constant";
import type { PublisherStats } from "@/live/whipPublisher";
import { isNotFoundError, StudioRequestError } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import { studioLiveService } from "@/services/studioLive.service";
import type { LiveState } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatScheduleTime } from "@/utils/schedule.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import styles from "./page.module.css";

const STATE_LABEL: Record<LiveState, string> = { idle: "Ready", connecting: "Connecting", live: "Live", ended: "Ended" };

type BroadcastMode = "browser" | "encoder";

const MODE_OPTIONS = [
  { value: "browser", label: "Camera in browser" },
  { value: "encoder", label: "OBS or encoder" },
] as const;

const isForbidden = (error: unknown) => error instanceof StudioRequestError && error.status === 403;

export default function ControlRoomPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const searchParams = useSearchParams();
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<BroadcastMode>(searchParams.get("mode") === "encoder" ? "encoder" : "browser");
  const [localStats, setLocalStats] = useState<PublisherStats | null>(null);
  const isRealtimeRef = useRef(false);
  const live = useQuery({ queryKey: ["live", liveId], queryFn: () => livesService.fetchLiveById(liveId), refetchInterval: () => (isRealtimeRef.current ? 30_000 : 5000) });
  const isOwner = Boolean(live.data && viewer && (live.data.hostId === null || live.data.hostId === viewer.id));
  const ended = live.data?.state === "ended";
  const health = useQuery({
    queryKey: ["stream-health", liveId],
    queryFn: () => studioLiveService.fetchStreamHealth(liveId),
    enabled: isOwner && !ended,
    refetchInterval: 4000,
    retry: (count, error) => !isForbidden(error) && count < 2,
  });

  const isRealtime = useControlRoomRealtime(liveId, isOwner && !ended);
  useEffect(() => {
    isRealtimeRef.current = isRealtime;
  }, [isRealtime]);

  const invalidate = useCallback(() => {
    for (const key of [["live", liveId], ["stream-health", liveId], ["live-stream-key", liveId], ["lives"]]) void queryClient.invalidateQueries({ queryKey: key });
  }, [liveId, queryClient]);

  const startLive = useMutation({ mutationFn: () => livesService.startLive(liveId), onSuccess: invalidate });
  const endLive = useMutation({ mutationFn: () => livesService.endLive(liveId), onSuccess: invalidate });

  async function confirmEndLive() {
    const confirmed = await requestConfirmation({ title: "End this live?", description: "Viewers are disconnected and the live can't be restarted. If OBS is still streaming, it's cut off too. Gifts already received stay in your earnings.", confirmLabel: "End live", intent: "stop", tone: "danger" });
    if (confirmed && !endLive.isPending) endLive.mutate();
  }

  if (live.isLoading) return <ControlRoomSkeleton label="Loading control room" />;
  if (live.isError || !live.data) {
    if (isNotFoundError(live.error)) return <ErrorState kind="liveUnavailable" error={live.error} action={<Link href="/lives">Back to Go live</Link>} />;
    return <ErrorState title="We couldn't load this live" error={live.error} action={<RetryButton onRetry={() => live.refetch()} />} />;
  }
  if (!isOwner || isForbidden(health.error)) {
    return <ErrorState title="This live belongs to another creator" description="You can only open the control room for lives you host." action={<Link href="/lives">Back to Go live</Link>} />;
  }

  const session = live.data;
  const isLive = session.state === "live";
  const encoderActive = mode === "browser" && health.data?.ingress?.protocol === "rtmp" && health.data.ingress.status === "publishing";
  const actionError = [startLive, endLive].find((mutation) => mutation.isError)?.error ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link href={ended ? "/lives/replays" : "/lives"} className={styles.back}>{ended ? "Replays" : "Go live"}</Link>
          <div className={styles.titleRow}>
            <span className={`${styles.stateBadge} ${styles[`state_${session.state}`]}`}>{STATE_LABEL[session.state]}</span>
            <h1 className={styles.title}>{session.title}</h1>
          </div>
          <p className={styles.meta}>
            {session.startedAt ? `Started ${formatTimeSincePosted(session.startedAt)} ago` : session.scheduledAt ? `Scheduled for ${formatScheduleTime(session.scheduledAt)}` : "Not started yet"}
            {" · "}
            {formatCountWithThousandsSuffix(session.viewers)} watching
            {" · "}
            {LIVE_CATEGORY_LABELS[session.category]}
          </p>
        </div>
        <div className={styles.headerActions}>
          {mode === "encoder" && (isLive || session.state === "connecting") ? (
            <Button variant="danger" busy={endLive.isPending} onClick={() => void confirmEndLive()}>End live</Button>
          ) : null}
          {mode === "encoder" && session.state === "idle" ? (
            <Button busy={startLive.isPending} onClick={() => !startLive.isPending && startLive.mutate()}>Start live</Button>
          ) : null}
          {!ended ? <Link href={`/lives/${session.id}/overlay`} className={styles.secondaryButton}>Overlay editor</Link> : null}
        </div>
      </header>

      {actionError ? <p className={styles.actionError} role="alert">{readLiveErrorMessage(actionError)}</p> : null}

      <LiveSafetyPanel liveId={session.id} isActive={isLive || session.state === "connecting"} isRealtime={isRealtime} />

      {!ended ? <StreamHealthPanel health={health.data} error={health.error} local={mode === "browser" ? localStats : null} onRetry={() => void health.refetch()} /> : null}

      {!ended ? (
        <section className={styles.card} aria-labelledby="broadcast-heading">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle} id="broadcast-heading">How you're streaming</h2>
            <SegmentedControl label="Streaming method" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>
          {mode === "browser" ? (
            <BrowserBroadcaster liveId={session.id} liveState={session.state} onStats={setLocalStats} onLiveChanged={invalidate} onUseEncoder={() => setMode("encoder")} encoderActive={encoderActive} />
          ) : (
            <EncoderSetupCard liveId={session.id} hlsUrl={session.hlsUrl} ended={ended} />
          )}
        </section>
      ) : (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>This live has ended</h2>
          <p className={styles.muted}>Its stream key no longer works. Watch the recording, if you had recording on, in <Link href="/lives/replays">Replays</Link>.</p>
        </section>
      )}

      <LiveEarningsPanel earnings={session.earnings} viewers={session.viewers} peakViewers={session.peakViewers} ranking={session.hostRanking} />

      <StageGuestsPanel liveId={session.id} isActive={isLive} isRealtime={isRealtime} />

      <LiveControlColumns liveId={session.id} canPinProducts={Boolean(session.storeId)} ended={ended} isRealtime={isRealtime} />

      {!ended ? <LiveChatSettingsCard liveId={session.id} /> : null}
    </div>
  );
}
