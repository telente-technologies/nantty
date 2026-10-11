"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { LiveDetailsFields, useLiveDetails, type LiveDetailsValue } from "@/components/golive/liveDetailsFields";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { CalendarIcon, CameraIcon, CodeIcon } from "@/components/ui/icons";
import { ListPageSkeleton } from "@/components/ui/pageSkeletons";
import { LIVE_CATEGORY_LABELS } from "@/constants/liveCategories.constant";
import { livesService } from "@/services/lives.service";
import type { LiveSession, LiveState } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

import styles from "./hub.module.css";

const STATE_LABEL: Record<LiveState, string> = { idle: "Ready", connecting: "Connecting", live: "Live", ended: "Ended" };

type Method = "browser" | "encoder";

export default function GoLivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [details, setDetails] = useState<LiveDetailsValue>({ title: "", category: "justChatting", storeId: null });
  const [formError, setFormError] = useState<string | null>(null);
  const createInFlight = useRef(false);
  const resolved = useLiveDetails(details);
  const lives = useQuery({ queryKey: ["lives"], queryFn: () => livesService.listLives() });
  const onAir = lives.data?.find((live) => live.state === "live" || live.state === "connecting") ?? null;
  const ready = (lives.data ?? []).filter((live) => live.state === "idle" && !live.scheduledAt);

  const createLive = useMutation({
    mutationFn: (method: Method) => livesService.createLive({ title: resolved.title, category: resolved.category, storeId: resolved.storeId || null }).then((live) => ({ live, method })),
    onSuccess: ({ live, method }) => {
      void queryClient.invalidateQueries({ queryKey: ["lives"] });
      router.push(`/lives/${live.id}?mode=${method}`);
    },
    onError: (error: Error) => setFormError(readLiveErrorMessage(error)),
  });

  function create(method: Method) {
    setFormError(null);
    if (createInFlight.current) return;
    createInFlight.current = true;
    createLive.mutate(method, { onSettled: () => { createInFlight.current = false; } });
  }

  if (lives.isLoading) return <ListPageSkeleton label="Loading your lives" />;

  return (
    <>
      {onAir ? (
        <div className={styles.banner} role="status">
          <span><strong>You're live:</strong> {onAir.title}</span>
          <Link href={`/lives/${onAir.id}`} className={styles.rowLink}>Open control room</Link>
        </div>
      ) : null}

      <section className={styles.formCard} aria-labelledby="new-live-heading">
        <h2 className={styles.sectionTitle} id="new-live-heading">Start a new live</h2>
        <LiveDetailsFields value={details} onChange={setDetails} />
        <div className={styles.methodGrid} role="group" aria-label="How do you want to stream?">
          <button type="button" className={styles.method} disabled={createLive.isPending || resolved.stores.isLoading || onAir !== null} onClick={() => create("browser")}>
            <span className={styles.methodTitle}><CameraIcon size={20} /> Use this browser</span>
            <span className={styles.methodDetail}>Camera, microphone and screen share. Nothing to install.</span>
          </button>
          <button type="button" className={styles.method} disabled={createLive.isPending || resolved.stores.isLoading || onAir !== null} onClick={() => create("encoder")}>
            <span className={styles.methodTitle}><CodeIcon size={20} /> Use OBS or an encoder</span>
            <span className={styles.methodDetail}>Get a server URL and stream key for OBS, Streamlabs or a hardware encoder.</span>
          </button>
          <Link href="/lives/scheduled" className={styles.method}>
            <span className={styles.methodTitle}><CalendarIcon size={20} /> Schedule for later</span>
            <span className={styles.methodDetail}>Pick a time. Your followers get a reminder before you go live.</span>
          </Link>
        </div>
        {createLive.isPending ? <p className={styles.muted} role="status">Setting up your live…</p> : null}
        {onAir ? <p className={styles.muted}>End your current live before starting another.</p> : null}
        {formError ? <p className={styles.formError} role="alert">{formError}</p> : null}
      </section>

      {lives.isError ? <ErrorState title="We couldn't load your lives" error={lives.error} onRetry={() => void lives.refetch()} /> : null}

      {lives.data && lives.data.length > 0 ? <LiveHistoryTotals lives={lives.data} /> : null}

      <section className={styles.section} aria-labelledby="ready-heading">
        <h2 className={styles.sectionTitle} id="ready-heading">Ready to stream</h2>
        {lives.isSuccess && ready.length === 0 ? (
          <EmptyState title="Nothing waiting" description="Lives you've set up but not started appear here. Past lives are in Replays, planned ones in Scheduled." />
        ) : (
          <ul className={styles.list}>
            {ready.map((live) => <LiveRow key={live.id} live={live} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function LiveRow({ live }: { readonly live: LiveSession }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitleRow}>
          <span className={`${styles.stateBadge} ${styles[`state_${live.state}`]}`}>{STATE_LABEL[live.state]}</span>
          <span className={styles.rowTitle}>{live.title}</span>
        </div>
        <p className={styles.rowMeta}>Created {formatTimeSincePosted(live.createdAt)} ago · {LIVE_CATEGORY_LABELS[live.category]}</p>
      </div>
      <div className={styles.rowActions}>
        <Link href={`/lives/${live.id}`} className={styles.rowLink} aria-label={`Open control room for ${live.title}`}>Control room</Link>
        <Link href={`/lives/${live.id}/overlay`} className={styles.rowLinkMuted} aria-label={`Overlay editor for ${live.title}`}>Overlay editor</Link>
      </div>
    </li>
  );
}

function LiveHistoryTotals({ lives }: { readonly lives: readonly LiveSession[] }) {
  const streamed = lives.filter((live) => live.startedAt !== null);
  const totals = [
    { label: "Lives streamed", value: formatCountWithThousandsSuffix(streamed.length) },
    { label: "Coins from lives", value: formatCountWithThousandsSuffix(lives.reduce((sum, live) => sum + live.earnings.coins, 0)) },
    { label: "Gifts received", value: formatCountWithThousandsSuffix(lives.reduce((sum, live) => sum + live.earnings.giftCount, 0)) },
    { label: "Best peak", value: formatCountWithThousandsSuffix(Math.max(0, ...lives.map((live) => live.peakViewers))) },
  ];
  return (
    <ul className={styles.totals} aria-label="Live history totals">
      {totals.map((total) => (
        <li key={total.label} className={styles.total}>
          <span className={styles.totalLabel}>{total.label}</span>
          <strong className={styles.totalValue}>{total.value}</strong>
        </li>
      ))}
    </ul>
  );
}
