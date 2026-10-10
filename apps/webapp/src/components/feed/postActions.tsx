"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ShareToChatButton } from "@/components/actions/shareToChatButton";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSaveToggle } from "@/components/saves/useSaveToggle.hook";
import {
  BookmarkActionIcon,
  BookmarkFilledActionIcon,
  LikeActionIcon,
  LikeFilledActionIcon,
  ReplyActionIcon,
  RepostActionIcon,
  ShareActionIcon,
  ViewsActionIcon,
} from "@/components/ui/icons";
import { Dialog } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import type { Post, SaveTargetType } from "@/types";
import { formatCompactCount } from "@/utils/formatDate.util";
import { addRepostEverywhere } from "@/utils/postEngagementCache.util";

import styles from "./postActions.module.css";
import { describeCount } from "@/utils/countLabel.util";

const ICON_SIZE = 19;

type ActionTone = "reply" | "repost" | "like" | "bookmark";

function ActionContent({ icon, count }: { readonly icon: ReactNode; readonly count?: number }) {
  return (
    <>
      <span className={styles.halo}>{icon}</span>
      {count && count > 0 ? <span className={styles.count}>{formatCompactCount(count)}</span> : null}
    </>
  );
}

const actionClassName = (tone: ActionTone, isActive = false, shouldPop = false) =>
  [styles.action, styles[tone], isActive ? styles.active : "", isActive && shouldPop ? styles.pop : ""].filter(Boolean).join(" ");

interface PostActionsProps {
  readonly post: Post;
  readonly saveTargetType: SaveTargetType;
  readonly isOwnPost: boolean;
  readonly isLiked: boolean;
  readonly likeCount: number;
  readonly onToggleLike: () => void;
  readonly likePopSignal?: number;
}

export function PostActions({ post, saveTargetType, isOwnPost, isLiked, likeCount, onToggleLike, likePopSignal = 0 }: PostActionsProps) {
  const { isSaved, toggleSaved } = useSaveToggle(saveTargetType, post.id, post.bookmarked);
  const queryClient = useQueryClient();
  const [hasReposted, setHasReposted] = useState(false);
  const [viewsInfoOpen, setViewsInfoOpen] = useState(false);
  const [lastToggledTone, setLastToggledTone] = useState<ActionTone | null>(null);
  useEffect(() => {
    if (likePopSignal > 0) setLastToggledTone("like");
  }, [likePopSignal]);
  const repostMutation = useMutation({
    mutationFn: () => postsService.repostPost(post.id),
    onMutate: () => {
      setHasReposted(true);
      showToast({ text: "Reposted" });
    },
    onSuccess: () => addRepostEverywhere(queryClient, post.id),
    onError: (error) => {
      setHasReposted(false);
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    },
  });
  const savedCount = Math.max((post.saveCount ?? 0) + (isSaved === post.bookmarked ? 0 : isSaved ? 1 : -1), 0);
  const repostCount = post.reposts + (repostMutation.isPending ? 1 : 0);

  return (
    <div className={styles.row}>
      <Link href={`/post/${post.id}#comments`} className={actionClassName("reply")} aria-label={`Reply, ${describeCount(post.comments, "reply", "replies")}`}>
        <ActionContent icon={<ReplyActionIcon size={ICON_SIZE} />} count={post.comments} />
      </Link>
      <button
        type="button"
        className={actionClassName("repost", hasReposted, lastToggledTone === "repost")}
        aria-pressed={hasReposted}
        aria-label={`Repost, ${describeCount(repostCount, "repost", "reposts")}`}
        onClick={() =>
          requireAuthThen(() => {
            if (hasReposted) return;
            setLastToggledTone("repost");
            repostMutation.mutate();
          }, "Sign in to repost.")
        }
      >
        <ActionContent icon={<RepostActionIcon size={ICON_SIZE} />} count={repostCount} />
      </button>
      <button
        type="button"
        className={actionClassName("like", isLiked, lastToggledTone === "like")}
        aria-pressed={isLiked}
        aria-label={`${isLiked ? "Unlike" : "Like"}, ${describeCount(likeCount, "like", "likes")}`}
        onClick={() => {
          setLastToggledTone("like");
          onToggleLike();
        }}
      >
        <ActionContent icon={isLiked ? <LikeFilledActionIcon size={ICON_SIZE} /> : <LikeActionIcon size={ICON_SIZE} />} count={likeCount} />
      </button>
      {isOwnPost ? (
        <Link href={`/analytics/post/${post.id}`} className={actionClassName("reply")} aria-label={`View post analytics, ${describeCount(post.views, "view", "views")}`}>
          <ActionContent icon={<ViewsActionIcon size={ICON_SIZE} />} count={post.views} />
        </Link>
      ) : (
        <button type="button" className={actionClassName("reply")} aria-haspopup="dialog" aria-label={`Views, ${describeCount(post.views, "view", "views")}. What are views`} onClick={() => setViewsInfoOpen(true)}>
          <ActionContent icon={<ViewsActionIcon size={ICON_SIZE} />} count={post.views} />
        </button>
      )}
      <button
        type="button"
        className={actionClassName("bookmark", isSaved, lastToggledTone === "bookmark")}
        aria-pressed={isSaved}
        aria-label={`${isSaved ? `Remove ${saveTargetType} from saved` : `Save ${saveTargetType}`}, ${savedCount} saves`}
        onClick={() => {
          setLastToggledTone("bookmark");
          toggleSaved();
        }}
      >
        <ActionContent icon={isSaved ? <BookmarkFilledActionIcon size={ICON_SIZE} /> : <BookmarkActionIcon size={ICON_SIZE} />} count={savedCount} />
      </button>
      <ShareToChatButton
        kind={saveTargetType === "video" ? "video" : "post"}
        referenceId={post.id}
        className={actionClassName("reply")}
        icon={<span className={styles.halo}><ShareActionIcon size={ICON_SIZE} /></span>}
        iconOnly
      />
      <Dialog
        isOpen={viewsInfoOpen}
        onClose={() => setViewsInfoOpen(false)}
        title="Views"
        description="Times this post was seen. A view counts each time it appears on someone else's screen, including repeat views. The author's own views don't count."
        layout="sheet"
        size="small"
        icon={<ViewsActionIcon size={22} />}
        actions={[{ label: "Close", variant: "secondary", onClick: () => setViewsInfoOpen(false), isInitialFocus: true }]}
      >
        <Link href="/help/posts-and-feed/views-and-analytics" className={styles.learnMore} onClick={() => setViewsInfoOpen(false)}>
          Learn more about views
        </Link>
      </Dialog>
    </div>
  );
}
