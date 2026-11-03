"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { ShareToChatButton } from "@/components/actions/shareToChatButton";
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
import type { Post, SaveTargetType } from "@/types";
import { formatCompactCount } from "@/utils/formatDate.util";

import styles from "./postActions.module.css";
import { ReshareDialog } from "./reshareDialog";
import { ViewsExplainerDialog } from "./viewsExplainerDialog";
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
  const [isRepostSheetOpen, setIsRepostSheetOpen] = useState(false);
  const hasReposted = post.reposted === true;
  const [viewsInfoOpen, setViewsInfoOpen] = useState(false);
  const [lastToggledTone, setLastToggledTone] = useState<ActionTone | null>(null);
  useEffect(() => {
    if (likePopSignal > 0) setLastToggledTone("like");
  }, [likePopSignal]);
  const savedCount = Math.max((post.saveCount ?? 0) + (isSaved === post.bookmarked ? 0 : isSaved ? 1 : -1), 0);
  const repostCount = post.reposts;

  return (
    <div className={styles.row}>
      <div className={styles.primaryActions}>
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
        <Link href={`/post/${post.id}#comments`} className={actionClassName("reply")} aria-label={`Reply, ${describeCount(post.comments, "reply", "replies")}`}>
          <ActionContent icon={<ReplyActionIcon size={ICON_SIZE} />} count={post.comments} />
        </Link>
        <button
          type="button"
          className={actionClassName("repost", hasReposted, lastToggledTone === "repost")}
          aria-haspopup="dialog"
          aria-label={`${hasReposted ? "Reposted" : "Repost or quote"}, ${describeCount(repostCount, "repost", "reposts")}`}
          onClick={() => {
            setLastToggledTone("repost");
            setIsRepostSheetOpen(true);
          }}
        >
          <ActionContent icon={<RepostActionIcon size={ICON_SIZE} />} count={repostCount} />
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
      </div>
      <div className={styles.secondaryActions}>
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
          <ActionContent icon={isSaved ? <BookmarkFilledActionIcon size={ICON_SIZE} /> : <BookmarkActionIcon size={ICON_SIZE} />} />
        </button>
        <ShareToChatButton
          kind={saveTargetType === "video" ? "video" : "post"}
          referenceId={post.id}
          className={actionClassName("reply")}
          icon={<span className={styles.halo}><ShareActionIcon size={ICON_SIZE} /></span>}
          iconOnly
        />
      </div>
      <ViewsExplainerDialog isOpen={viewsInfoOpen} onClose={() => setViewsInfoOpen(false)} />
      <ReshareDialog post={isRepostSheetOpen ? post : null} onClose={() => setIsRepostSheetOpen(false)} />
    </div>
  );
}
