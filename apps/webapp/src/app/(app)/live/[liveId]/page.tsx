"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { LiveChatPanel } from "@/components/live/liveChatPanel";
import { LiveGiftTray } from "@/components/live/liveGiftTray";
import { LiveHostRankAvatar } from "@/components/live/liveHostRankAvatar";
import { LiveReportDialog } from "@/components/live/liveReportDialog";
import { LiveSafetyHostBanner, LiveSafetyOverlay } from "@/components/live/liveSafetyNotices";
import styles from "@/components/live/liveRoom.module.css";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { MediaImage } from "@/components/ui/media";
import { liveService } from "@/services/webActions.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

function canPlayInBrowser(url: string | null | undefined): url is string {
  return !!url && !url.endsWith(".m3u8");
}

export default function LiveRoomPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const liveQuery = useQuery({ queryKey: ["live", liveId], queryFn: () => liveService.fetchLiveSession(liveId), retry: false, refetchInterval: 10_000 });
  const [isReportOpen, setIsReportOpen] = useState(false);

  if (liveQuery.isLoading) {
    return (
      <div className={styles.room}>
        <Skeleton height="auto" className={styles.stage} />
        <Skeleton height={420} />
      </div>
    );
  }
  if (liveQuery.isError || !liveQuery.data) return <ErrorState description="This live isn't available." action={<RetryButton onRetry={() => liveQuery.refetch()} />} />;

  const live = liveQuery.data;
  const isLive = live.status === "live";
  const safety = isLive ? live.safety ?? null : null;
  const isPausedForSafety = safety?.state === "paused";
  const isHostView = !!safety?.hostReason || !!safety?.warningMessage;
  return (
    <div className={styles.room}>
      <div className={styles.main}>
        <div className={styles.stage}>
          {isLive && !(isPausedForSafety && !isHostView) && canPlayInBrowser(live.playbackUrl) ? (
            <video className={styles.video} src={live.playbackUrl} poster={live.coverUrl ?? undefined} autoPlay muted loop playsInline controls />
          ) : (
            <MediaImage src={live.coverUrl ?? null} alt="" sizes="(max-width: 1024px) 100vw, 720px" />
          )}
          <span className={isLive ? styles.liveBadge : styles.endedBadge}>{isLive ? "LIVE" : "Ended"}</span>
          {isLive ? <span className={styles.viewerBadge}>{formatCountWithThousandsSuffix(live.viewers)} watching</span> : null}
          {isPausedForSafety && !isHostView ? <LiveSafetyOverlay message={safety?.viewerMessage} /> : null}
        </div>
        {safety && isHostView ? <LiveSafetyHostBanner liveId={live.id} safety={safety} onAppealed={() => liveQuery.refetch()} /> : null}
        <div className={styles.hostBar}>
          <div className={styles.host}>
            <LiveHostRankAvatar hostName={live.host.name} avatarUrl={live.host.avatarUrl} ranking={isLive ? live.hostRanking : null} />
            <Link href={`/user/${live.host.id}`} className={styles.hostLink}>
              <span className={styles.hostName}>{live.host.name}</span>
              <span className={styles.liveTitle}>{live.title}</span>
            </Link>
          </div>
          <ContentActionsMenu shareKind="live" reportTargetType="live" targetId={live.id} canonicalPath={`/live/${live.id}`} onReport={() => setIsReportOpen(true)} />
        </div>
        {live.products.length > 0 ? (
          <ul className={styles.productStrip} aria-label="Products in this live">
            {live.products.map((product) => (
              <li key={product.id}>
                <Link href={`/product/${product.id}`} className={styles.productChip}>
                  <span className={styles.productThumb}>
                    <MediaImage src={product.imageUrl} alt="" sizes="40px" />
                  </span>
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <aside className={styles.side}>
        {isLive && live.giftsEnabled !== false ? <LiveGiftTray liveId={live.id} hostName={live.host.name} /> : null}
        <LiveChatPanel liveId={live.id} />
      </aside>
      <LiveReportDialog key={isReportOpen ? "open" : "closed"} isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} liveId={live.id} startedAt={live.startedAt} />
    </div>
  );
}
