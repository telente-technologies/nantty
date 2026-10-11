"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { isLiveVideoSupported } from "@zudomart/web-kit";

import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { LiveChatPanel } from "@/components/live/liveChatPanel";
import { LiveGiftTray } from "@/components/live/liveGiftTray";
import { LiveHostRankAvatar } from "@/components/live/liveHostRankAvatar";
import { LiveReportDialog } from "@/components/live/liveReportDialog";
import { LiveVideoPlayer } from "@/components/live/liveVideoPlayer";
import { LiveSafetyHostBanner, LiveSafetyOverlay } from "@/components/live/liveSafetyNotices";
import styles from "@/components/live/liveRoom.module.css";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { MediaImage } from "@/components/ui/media";
import { liveService } from "@/services/webActions.service";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { liveRoomBadgeLabel, orderProductsWithPinnedFirst, pollIntervalForLiveStatus, readLiveRoomStatus, shouldShowLiveRoomError } from "@/utils/liveRoom.util";
import type { LiveSessionDetails } from "@/types";

function FollowHostButton({ live }: { readonly live: LiveSessionDetails }) {
  const follow = useFollowUser({ userId: live.host.id, username: live.host.username, displayName: live.host.name, initialState: live.isFollowingHost ? "accepted" : "none" });
  return (
    <button type="button" className={styles.followButton} aria-pressed={follow.isActive} disabled={follow.isPending} onClick={follow.toggle}>
      {follow.label}
    </button>
  );
}

export default function LiveRoomPage({ params }: { readonly params: Promise<{ readonly liveId: string }> }) {
  const { liveId } = use(params);
  const liveQuery = useQuery({ queryKey: ["live", liveId], queryFn: () => liveService.fetchLiveSession(liveId), retry: false, refetchInterval: (query) => pollIntervalForLiveStatus(query.state.data?.status) });
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { viewer } = useSession();
  const [canPlayLiveVideo, setCanPlayLiveVideo] = useState(true);
  useEffect(() => setCanPlayLiveVideo(isLiveVideoSupported()), []);

  if (liveQuery.isLoading) {
    return (
      <div className={styles.room}>
        <Skeleton height="auto" className={styles.stage} />
        <Skeleton height={420} />
      </div>
    );
  }
  if (shouldShowLiveRoomError(!!liveQuery.data, liveQuery.isError) || !liveQuery.data) return <ErrorState subject="live" description="This live isn't available." error={liveQuery.error} onRetry={() => void liveQuery.refetch()} />;

  const live = liveQuery.data;
  const roomStatus = readLiveRoomStatus(live.status);
  const isLive = roomStatus === "live";
  const products = orderProductsWithPinnedFirst(live.products, live.pinnedProductId);
  const safety = isLive ? live.safety ?? null : null;
  const isPausedForSafety = safety?.state === "paused";
  const isHostView = !!safety?.hostReason || !!safety?.warningMessage;
  return (
    <div className={styles.room}>
      <div className={styles.main}>
        <div className={styles.stage}>
          {isLive && !canPlayLiveVideo ? (
            <ErrorState variant="compact" error={{ code: "WEBRTC_UNAVAILABLE" }} />
          ) : isLive && !(isPausedForSafety && !isHostView) ? (
            <LiveVideoPlayer
              liveId={live.id}
              hostId={live.host.id}
              coverUrl={live.coverUrl ?? null}
              isSignedIn={!!viewer}
              isOwnLive={viewer?.id === live.host.id}
              onRoomClosed={() => void liveQuery.refetch()}
            />
          ) : (
            <MediaImage src={live.coverUrl ?? null} alt="" sizes="(max-width: 1024px) 100vw, 720px" />
          )}
          <span className={isLive ? styles.liveBadge : styles.endedBadge}>{liveRoomBadgeLabel(roomStatus)}</span>
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
          {live.isFollowingHost === undefined || viewer?.id === live.host.id ? null : <FollowHostButton live={live} />}
          <ContentActionsMenu shareKind="live" reportTargetType="live" targetId={live.id} canonicalPath={`/live/${live.id}`} onReport={() => setIsReportOpen(true)} />
        </div>
        {products.length > 0 ? (
          <ul className={styles.productStrip} aria-label="Products in this live">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/product/${product.id}`} className={styles.productChip}>
                  <span className={styles.productThumb}>
                    <MediaImage src={product.imageUrl} alt="" sizes="40px" />
                  </span>
                  {product.name}
                  {product.id === live.pinnedProductId ? <span className={styles.pinnedTag}>Pinned</span> : null}
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
