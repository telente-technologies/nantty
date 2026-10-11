"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";

import { CommentsPanel } from "@/components/feed/commentsPanel";
import { usePostLike } from "@/components/feed/usePostLike.hook";
import { formatVideoDuration } from "@/components/feed/postCardMedia";
import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { HeartIcon, LikeFilledActionIcon, ShareActionIcon } from "@/components/ui/icons";
import { useFollowUser } from "@/components/follow/useFollowUser.hook";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { Avatar, MediaImage } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { InlineVideoPlayer } from "@/components/video/inlineVideoPlayer";
import { discoveryService } from "@/services/discovery.service";
import { postsService } from "@/services/posts.service";
import { findDownloadTargetForPost } from "@/utils/brandedDownload.util";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";
import type { Post } from "@/types";

import styles from "./page.module.css";

function UpNextList({ currentVideoId }: { readonly currentVideoId: string }) {
  const videosQuery = useQuery({ queryKey: ["videos", "upNext"], queryFn: () => discoveryService.fetchVideosPage(null), retry: false });
  const videos = (videosQuery.data?.data ?? []).filter((video) => video.id !== currentVideoId);
  return (
    <aside className={styles.upNext} aria-labelledby="up-next-title">
      <h2 id="up-next-title" className={styles.upNextTitle}>
        Up next
      </h2>
      {videosQuery.isLoading
        ? [0, 1, 2].map((index) => <Skeleton key={index} height={84} />)
        : videos.map((video) => (
            <Link key={video.id} href={`/watch/${video.id}`} className={styles.upNextItem}>
              <span className={styles.upNextThumb}>
                <MediaImage src={video.media[0]?.posterUrl ?? null} alt="" sizes="168px" />
                {video.media[0]?.durationSeconds ? <span className={styles.duration}>{formatVideoDuration(video.media[0].durationSeconds)}</span> : null}
              </span>
              <span className={styles.upNextText}>
                <span className={styles.upNextCaption}>{video.text}</span>
                <span className={styles.upNextMeta}>
                  {video.author.name} · {formatCountWithThousandsSuffix(video.views)} views
                </span>
              </span>
            </Link>
          ))}
    </aside>
  );
}

function VideoDetails({ video }: { readonly video: Post }) {
  const media = video.media[0];
  const isLiked = video.liked;
  const likeCount = video.likes;
  const { toggleLike } = usePostLike(video, "Sign in to like videos.");
  const follow = useFollowUser({ userId: video.author.id, username: video.author.username, displayName: video.author.name, initialState: video.isFollowingAuthor ? "accepted" : "none" });
  const [shareCount, setShareCount] = useState(video.reposts);

  function shareVideoLink() {
    const url = buildAbsoluteSiteUrl(`/watch/${video.id}`);
    const copyAndRecord = async () => {
      try {
        await navigator.clipboard.writeText(url);
        showToast({ text: "Link copied" });
      } catch {
        showToast({ text: "Couldn't copy the link", tone: "error" });
      }
      setShareCount((count) => count + 1);
      void postsService.recordPostShare(video.id).catch(() => setShareCount(video.reposts));
    };
    void copyAndRecord();
  }

  return (
    <div className={styles.main}>
      <div className={styles.player}>
        {media?.url ? (
          <InlineVideoPlayer key={video.id} className={styles.video} src={media.url} poster={media.posterUrl} durationSeconds={media.durationSeconds} label="Video player" documentShortcuts />
        ) : null}
      </div>
      <h1 className={styles.caption}>{video.text}</h1>
      <div className={styles.bar}>
        <div className={styles.authorWrap}>
          <Link href={`/user/${video.author.id}`} className={styles.author}>
            <Avatar name={video.author.name} src={video.author.avatarUrl} size="md" />
            <span className={styles.authorText}>
              <span className={styles.authorName}>{video.author.name}</span>
              <span className={styles.authorMeta}>
                {formatCountWithThousandsSuffix(video.views)} views · {formatTimeSincePosted(video.createdAt)}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className={[styles.followPill, follow.isActive ? styles.followPillActive : ""].join(" ")}
            aria-pressed={follow.isActive}
            disabled={follow.isPending}
            onClick={follow.toggle}
          >
            {follow.label}
          </button>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.stat} aria-pressed={isLiked} aria-label={isLiked ? "Unlike this video" : "Like this video"} onClick={toggleLike}>
            {isLiked ? <LikeFilledActionIcon size={18} /> : <HeartIcon size={18} />} {formatCountWithThousandsSuffix(likeCount)}
          </button>
          <button type="button" className={styles.stat} aria-label="Copy link to this video" onClick={shareVideoLink}>
            <ShareActionIcon size={18} /> {formatCountWithThousandsSuffix(shareCount)}
          </button>
          <ShareToChatButton kind="video" referenceId={video.id} className={styles.stat} label={formatCountWithThousandsSuffix(video.reposts)} />
          <SaveToggleButton targetType="video" targetId={video.id} initiallySaved={video.bookmarked} appearance="pill" saveCount={video.saveCount ?? 0} />
          <ContentActionsMenu shareKind={null} reportTargetType="post" targetId={video.id} canonicalPath={`/watch/${video.id}`} downloadTarget={findDownloadTargetForPost(video)} />
        </div>
      </div>
      <CommentsPanel postId={video.id} postAuthorId={video.author.id} totalComments={video.comments} />
    </div>
  );
}

export default function WatchVideoPage({ params }: { readonly params: Promise<{ readonly videoId: string }> }) {
  const { videoId } = use(params);
  const videoQuery = useQuery({ queryKey: ["video", videoId], queryFn: () => discoveryService.fetchVideoById(videoId), retry: false });

  return (
    <div className={styles.layout}>
      {videoQuery.isLoading ? (
        <div className={styles.main}>
          <Skeleton height="auto" className={styles.playerSkeleton} />
          <Skeleton height={20} width="70%" />
        </div>
      ) : videoQuery.isError || !videoQuery.data ? (
        <ErrorState description="This video isn't available." error={videoQuery.error} onRetry={() => void videoQuery.refetch()} />
      ) : (
        <VideoDetails video={videoQuery.data} />
      )}
      <UpNextList currentVideoId={videoId} />
    </div>
  );
}
