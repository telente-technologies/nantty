"use client";

import Link from "next/link";
import { use, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { ControlRoomSkeleton } from "@/components/ui/pageSkeletons";
import { LiveEarningsPanel } from "@/components/live/liveEarningsPanel";
import { LiveSafetyPanel } from "@/components/live/liveSafetyPanel";
import { StageGuestsPanel } from "@/components/live/stageGuestsPanel";
import { useSession } from "@/components/providers/sessionProvider";
import { LIVE_CATEGORY_LABELS } from "@/constants/liveCategories.constant";
import { RetryButton } from "@/components/ui/controls";
import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { isNotFoundError, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import type { LiveState } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CopyField, copyGridClassName } from "./copyField";
import styles from "./page.module.css";

const STATE_LABEL: Record<LiveState, string> = { idle: "Ready", connecting: "Connecting", live: "Live", ended: "Ended" };

export default function ControlRoomPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const { viewer } = useSession();
  const canPinProducts = Boolean(viewer?.hasStore);
  const queryClient = useQueryClient();
  const live = useQuery({ queryKey: ["live", liveId], queryFn: () => livesService.fetchLiveById(liveId), refetchInterval: 5000 });
  const comments = useQuery({ queryKey: ["live-comments", liveId], queryFn: () => livesService.listComments(liveId), refetchInterval: 5000 });
  const products = useQuery({ queryKey: ["live-products", liveId], queryFn: () => livesService.listPinnedProducts(liveId), enabled: canPinProducts });
  const catalogue = useQuery({ queryKey: ["live-catalogue"], queryFn: () => livesService.listPinneableProducts(), enabled: canPinProducts });
  const streamKey = useQuery({ queryKey: ["live-stream-key", liveId], queryFn: () => livesService.fetchStreamKey(liveId) });
  const overlayScene = useQuery({ queryKey: ["overlay-scene", liveId], queryFn: () => livesService.fetchOverlays(liveId) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["live", liveId] });
    queryClient.invalidateQueries({ queryKey: ["live-comments", liveId] });
    queryClient.invalidateQueries({ queryKey: ["live-products", liveId] });
    queryClient.invalidateQueries({ queryKey: ["lives"] });
  };

  const startLive = useMutation({ mutationFn: () => livesService.startLive(liveId), onSuccess: invalidate });
  const endLive = useMutation({ mutationFn: () => livesService.endLive(liveId), onSuccess: invalidate });
  const rotateKey = useMutation({ mutationFn: () => livesService.rotateStreamKey(liveId), onSuccess: (key) => queryClient.setQueryData(["live-stream-key", liveId], key) });
  const pinProduct = useMutation({
    mutationFn: (productId: string) => livesService.pinProduct(liveId, productId),
    onSuccess: invalidate,
  });

  const [commentDraft, setCommentDraft] = useState("");
  const postComment = useMutation({
    mutationFn: () => livesService.postComment(liveId, commentDraft.trim()),
    onSuccess: () => {
      setCommentDraft("");
      queryClient.invalidateQueries({ queryKey: ["live-comments", liveId] });
    },
  });

  if (live.isLoading) return <ControlRoomSkeleton label="Loading control room" />;
  if (live.isError || !live.data) {
    if (isNotFoundError(live.error)) return <ErrorState title="Live not found" description="This live may have been removed." action={<Link href="/lives">Back to all lives</Link>} />;
    return <ErrorState title="We couldn't load this live" description={readErrorMessageForDisplay(live.error)} action={<RetryButton onRetry={() => live.refetch()} />} />;
  }

  const actionError = [startLive, endLive, rotateKey, pinProduct].find((mutation) => mutation.isError)?.error ?? null;

  const session = live.data;
  const isLive = session.state === "live";
  const overlayUrl = overlayScene.data ? `${readPublicSiteUrl()}/overlay/${overlayScene.data.id}` : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link href="/lives" className={styles.back}>
            All lives
          </Link>
          <div className={styles.titleRow}>
            <span className={`${styles.stateBadge} ${styles[`state_${session.state}`]}`}>{STATE_LABEL[session.state]}</span>
            <h1 className={styles.title}>{session.title}</h1>
          </div>
          <p className={styles.meta}>
            {session.startedAt ? `Started ${formatTimeSincePosted(session.startedAt)}` : "Not started yet"}
            {" · "}
            {formatCountWithThousandsSuffix(session.viewers)} watching
            {" · "}
            {formatCountWithThousandsSuffix(session.peakViewers)} peak
            {" · "}
            {LIVE_CATEGORY_LABELS[session.category]}
          </p>
        </div>
        <div className={styles.headerActions}>
          {isLive || session.state === "connecting" ? (
            <Button variant="danger" busy={endLive.isPending} onClick={() => endLive.mutate()}>
              End live
            </Button>
          ) : (
            <Button busy={startLive.isPending} onClick={() => startLive.mutate()}>
              Start live
            </Button>
          )}
          <Link href={`/lives/${session.id}/overlay`} className={styles.secondaryButton}>
            Overlay editor
          </Link>
        </div>
      </header>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {readErrorMessageForDisplay(actionError)}
        </p>
      ) : null}

      <LiveSafetyPanel liveId={session.id} isActive={isLive || session.state === "connecting"} />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Connect OBS or any encoder</h2>
          <Button variant="secondary" size="sm" busy={rotateKey.isPending} onClick={() => rotateKey.mutate()}>
            {streamKey.data ? "Rotate stream key" : "Create stream key"}
          </Button>
        </div>
        <ol className={styles.steps}>
          <li>Open OBS › Settings › Stream, then choose <strong>Custom…</strong> as the service.</li>
          <li>Paste the server URL below into <strong>Server</strong>.</li>
          <li>Paste the stream key into <strong>Stream Key</strong>.</li>
          <li>Add the overlay as a <strong>Browser</strong> source at 1920 × 1080 (use it for alerts, gift goals or your logo), then hit Start Streaming.</li>
        </ol>
        {streamKey.isSuccess && !streamKey.data ? <p className={styles.muted}>No stream key yet. Create one to connect your encoder.</p> : null}
        {streamKey.isError ? <p className={styles.actionError} role="alert">{readErrorMessageForDisplay(streamKey.error)}</p> : null}
        <div className={copyGridClassName}>
          {streamKey.data ? <CopyField label="Server URL" value={streamKey.data.ingestUrl} /> : null}
          {streamKey.data ? <CopyField label="Stream key" value={streamKey.data.streamKey} masked /> : null}
          {overlayUrl ? <CopyField label="Overlay browser source (1920 × 1080)" value={overlayUrl} /> : null}
          {session.hlsUrl ? <CopyField label="Playback (HLS)" value={session.hlsUrl} /> : null}
        </div>
      </section>

      <LiveEarningsPanel earnings={session.earnings} viewers={session.viewers} peakViewers={session.peakViewers} />

      <StageGuestsPanel liveId={session.id} isActive={isLive} />

      <div className={styles.columns}>
        {canPinProducts ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Pinned products (optional)</h2>
          <ul className={styles.list}>
            {products.data?.map((product) => (
              <li key={product.id} className={styles.listItem}>
                <span className={styles.listItemMain}>{product.title}</span>
                <span className={styles.listItemMeta}>{formatMoneyForDisplay(product.price)}{product.pinned ? " · On screen" : ""}</span>
              </li>
            ))}
          </ul>
          {products.isError ? <ErrorState title="Pinned products didn't load" description={readErrorMessageForDisplay(products.error)} onRetry={() => void products.refetch()} /> : null}
          {products.isSuccess && products.data.length === 0 ? <p className={styles.muted}>Nothing pinned yet. Pick a product below to show it on stream.</p> : null}
          <div className={styles.chipRow}>
            {catalogue.data
              ?.filter((product) => !products.data?.some((pinned) => pinned.id === product.id))
              .map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={styles.chip}
                  disabled={pinProduct.isPending}
                  onClick={() => pinProduct.mutate(product.id)}
                >
                  + {product.title}
                </button>
              ))}
          </div>
        </section>
        ) : null}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Live chat</h2>
          <ul className={styles.list}>
            {comments.data?.map((comment) => (
              <li key={comment.id} className={styles.listItem}>
                <span className={styles.listItemMain}>
                  <strong>{comment.authorName}</strong> {comment.text}
                </span>
                <span className={styles.listItemMeta}>{formatTimeSincePosted(comment.createdAt)}</span>
              </li>
            ))}
          </ul>
          {comments.isError ? <ErrorState title="Chat didn't load" description={readErrorMessageForDisplay(comments.error)} onRetry={() => void comments.refetch()} /> : null}
          {comments.isSuccess && comments.data.length === 0 ? <p className={styles.muted}>No comments yet. They appear here as viewers chat.</p> : null}
          {postComment.isError ? <p className={styles.actionError} role="alert">{readErrorMessageForDisplay(postComment.error)}</p> : null}
          <form
            className={styles.commentForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (commentDraft.trim()) postComment.mutate();
            }}
          >
            <input
              className={styles.commentInput}
              aria-label="Comment"
              placeholder="Say something to your viewers"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
            />
            <Button type="submit" busy={postComment.isPending} disabled={!commentDraft.trim()}>
              Send
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
