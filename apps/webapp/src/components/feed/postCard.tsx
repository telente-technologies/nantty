"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LikeFilledActionIcon, ReplyActionIcon, TagIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionText } from "@/components/mentions/mentionText";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { useSession } from "@/components/providers/sessionProvider";
import { CopyrightCountdownBanner } from "@/components/copyright/copyrightCountdownBanner";
import { Avatar, MediaImage } from "@/components/ui/media";
import { findDownloadTargetForPost } from "@/utils/brandedDownload.util";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsService } from "@/services/posts.service";
import { WebappRequestError } from "@/services/clientApi.service";
import type { Post } from "@/types";

import styles from "./postCard.module.css";
import swipeStyles from "./postSwipe.module.css";
import { usePostSwipe } from "./postSwipe.hook";
import { usePostLike } from "./usePostLike.hook";
import { PostActions } from "./postActions";
import { SponsoredAdBody, SponsoredMediaLink } from "./sponsoredAd";
import { hasVideoMedia, isLandscapeVideoPost, PostMedia } from "./postCardMedia";
import { AppIcon } from "@/components/ui/appIcon";
import { buildProductPath, buildProfilePath } from "@/utils/seoPaths.util";
import { PostLinkCard } from "./postLinkCard";
import { SensitiveContentGate } from "./sensitiveContentGate";
import { ViewQuotesLink } from "./viewQuotesLink";
import { usePostNotificationMute } from "./postNotificationMute.hook";
import { canOfferPostNotificationMute } from "@/utils/postNotificationMute.util";
import { QuotedPostCard } from "./quotedPostCard";
import { quotedSummaryFromPost } from "@/utils/quotedPostLinks.util";
import { TaggedPeopleLine } from "@/components/taggedPeople/taggedPeopleLine";

export function PostCard({ post, priority = false, swipeable = false, showPinnedBadge = false }: { readonly post: Post; readonly priority?: boolean; readonly swipeable?: boolean; readonly showPinnedBadge?: boolean }) {
  const router = useRouter();
  const [likePopSignal, setLikePopSignal] = useState(0);
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const { toggleLike, likeIfNotLiked } = usePostLike(post);
  const isOwnPost = viewer?.id === post.author.id;
  const notificationMute = usePostNotificationMute(post);
  const [optimisticPinned, setOptimisticPinned] = useState(post.isPinned === true);
  const pinMutation = useMutation({
    mutationFn: () => (optimisticPinned ? postsService.unpinPost(post.id) : postsService.pinPost(post.id)),
    onMutate: () => setOptimisticPinned((pinned) => !pinned),
    onSuccess: (updated) => {
      setOptimisticPinned(updated.isPinned === true);
      void queryClient.invalidateQueries({ queryKey: ["profile", "posts", post.author.id] });
      void queryClient.invalidateQueries({ queryKey: ["profile", "clips", post.author.id] });
      void queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
    onError: (error) => {
      setOptimisticPinned(post.isPinned === true);
      showToast({ text: error instanceof WebappRequestError && error.code === "PIN_LIMIT_REACHED" ? "You can pin up to 3 posts. Unpin one to pin another." : "Couldn't update the pin. Try again.", tone: "error" });
    },
  });
  const swipe = usePostSwipe({
    enabled: swipeable && !post.sponsored,
    isLiked: post.liked,
    onLike: () =>
      requireAuthThen(() => {
        setLikePopSignal((signal) => signal + 1);
        likeIfNotLiked();
      }, "Sign in to like posts."),
    onOpenComments: () => router.push(`/post/${post.id}#comments`),
  });

  const card = (
    <article className={[styles.card, swipe.isActive ? swipeStyles.card : ""].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <Link href={buildProfilePath(post.author.username)} className={styles.author}>
          <Avatar name={post.author.name} src={post.author.avatarUrl} size="md" />
          <span className={styles.authorText}>
            <span className={styles.authorName}>
              {post.author.name}
              {post.author.verified ? <span className={styles.verified} aria-label="Verified account"><AppIcon name="check16" size={10} /></span> : null}
            </span>
            <span className={styles.authorMeta}>@{post.author.username}</span>
          </span>
        </Link>
        {post.sponsored ? <span className={post.sponsored.label === "Boosted" ? styles.boosted : styles.sponsored}>{post.sponsored.label === "Boosted" ? <AppIcon name="rocketLaunch16" size={11} /> : null}{post.sponsored.label}</span> : null}
        {showPinnedBadge && optimisticPinned ? (
          <span className={styles.pinned} aria-label="Pinned post">
            <AppIcon name="pushPin24" size={12} /> Pinned
          </span>
        ) : null}
        <Link href={`/post/${post.id}`} className={styles.timestamp}>
          <time dateTime={post.createdAt}>{formatTimeSincePosted(post.createdAt)}</time>
        </Link>
        <ContentActionsMenu
          shareKind={hasVideoMedia(post) ? "video" : "post"}
          reportTargetType="post"
          targetId={post.id}
          canonicalPath={`/post/${post.id}`}
          isOwnContent={viewer?.id === post.author.id}
          downloadTarget={findDownloadTargetForPost(post)}
          notificationMuteAction={canOfferPostNotificationMute(viewer !== null, post) ? { isMuted: notificationMute.isMuted, onToggle: notificationMute.toggle } : undefined}
          pinAction={isOwnPost ? { isPinned: optimisticPinned, onTogglePin: () => requireAuthThen(() => pinMutation.mutate(), "Sign in to pin posts."), disabled: pinMutation.isPending } : undefined}
        />
      </header>

      {viewer?.id === post.author.id ? <CopyrightCountdownBanner contentId={post.id} /> : null}
      <SensitiveContentGate postId={post.id} sensitive={post.sensitive} previewUrl={post.media[0]?.posterUrl ?? post.media[0]?.url ?? null}>
      {post.text ? (
        <p className={styles.text}>
          <MentionText text={post.text} mentions={post.mentions} />
        </p>
      ) : null}
      <PostLinkCard post={post} />
      {post.sponsored?.adType === "carousel" ? null : (
        <SponsoredMediaLink post={post}>
          <PostMedia media={post.media} priority={priority} watchHref={isLandscapeVideoPost(post) && !post.sponsored ? `/watch/${post.id}` : null} />
        </SponsoredMediaLink>
      )}
      <SponsoredAdBody post={post} />
      {post.resharedFrom || post.resharedFromUnavailable ? <QuotedPostCard quoted={post.resharedFrom ? quotedSummaryFromPost(post.resharedFrom) : null} unavailable={!post.resharedFrom} /> : null}
      </SensitiveContentGate>
      <TaggedPeopleLine post={post} />

      {post.products.length > 0 ? (
        <div className={styles.productStrip}>
          <span className={styles.productStripLabel}>
            <TagIcon size={14} /> Tagged
          </span>
          {post.products.slice(0, 4).map((product) => (
            <Link key={product.id} href={buildProductPath(product)} className={styles.productChip}>
              <span className={styles.productChipThumb}>
                <MediaImage src={product.imageUrl} alt="" sizes="48px" />
              </span>
              <span className={styles.productChipName}>{product.name}</span>
              <span className={styles.productChipPrice}>{formatMoneyForDisplay(product.price)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <footer className={styles.footer}>
        <PostActions
          post={post}
          saveTargetType={hasVideoMedia(post) ? "video" : "post"}
          isOwnPost={viewer?.id === post.author.id}
          isLiked={post.liked}
          likeCount={post.likes}
          onToggleLike={toggleLike}
          likePopSignal={likePopSignal}
        />
        <ViewQuotesLink post={post} />
      </footer>
    </article>
  );

  if (!swipe.isActive) return card;
  return (
    <div ref={swipe.frameRef} className={swipeStyles.frame} {...swipe.frameHandlers}>
      <div className={swipeStyles.hints} aria-hidden="true">
        <span className={[swipeStyles.hint, swipeStyles.likeHint].join(" ")}>
          <LikeFilledActionIcon size={26} />
          {post.liked ? "Liked" : "Like"}
        </span>
        <span className={[swipeStyles.hint, swipeStyles.replyHint].join(" ")}>
          <ReplyActionIcon size={26} />
          Reply
        </span>
      </div>
      {card}
    </div>
  );
}
