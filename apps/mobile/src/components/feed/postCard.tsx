import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from "react-native";

import { MentionText } from "@/components/mentions/mentionText";
import { BoxArrowDown24Icon, DotsThreeVertical24Icon, Group1256Icon, ReplyActionIcon } from "@/components/icons";
import { isContentLockedForViewer, SubscriberOnlyLock } from "@/components/coins/subscriberOnlyLock";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { FriendsLikedAvatarStack } from "@/components/feed/friendsLikedAvatarStack";
import { Avatar } from "@/components/ui/avatar";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useAuthStore } from "@/store/auth.store";
import type { AdPlacement, Post } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { useIsFeedItemVisibleForAutoplay } from "./feedVisibility.hook";
import { CommentStickerOverlay } from "@/components/clips/videoReply/commentStickerOverlay";
import { MediaPager } from "./mediaPager";
import { PostActionRow } from "./postActionRow";
import { ReplySettingsSheet } from "./replySettingsSheet";
import { SensitiveContentGate } from "./sensitiveContentGate";
import { ViewQuotesLink } from "./viewQuotesLink";
import { ResharedPostBlock } from "./resharedPostBlock";
import { AiGeneratedLabel } from "@/components/feed/aiGeneratedLabel";
import { SponsoredCallToAction, SponsoredLabel } from "./sponsoredContent";
import { SponsoredMedia } from "./sponsoredMedia";
import { LikeBurst } from "@/components/clips/likeBurst";
import { saveTargetForPost } from "@/types";
import { webAppLinks } from "@/config/webAppLinks.config";
import { PostLinkCard } from "./postLinkCard";
import { TaggedPeopleLine } from "@/components/taggedPeople/taggedPeopleLine";
import { canOfferDownloadForPost, findFirstDownloadableMedia, isDownloadableMedia } from "@/components/downloads/downloadablePostMedia.util";
import { useMediaDownloadStore } from "@/store/mediaDownload.store";
import { requireAuthThen } from "@/utils/requireAuth.util";

const DOUBLE_TAP_WINDOW_MS = 280;

export interface PostCardProps {
  readonly post: Post;
  readonly onPressAuthor?: () => void;
  readonly onToggleFollow?: () => void;
  readonly onToggleLike?: () => void;
  readonly onPressComments?: () => void;
  readonly onRepost?: () => void;
  readonly onShare?: () => void;
  readonly onPressMore?: () => void;
  readonly onPressViewProducts?: () => void;
  readonly onPressAnalytics?: () => void;
  readonly onPress?: () => void;
  readonly onPressOriginalPost?: () => void;
  readonly adPlacement?: AdPlacement;
  readonly likePopKey?: number;
  readonly onMediaPagerTouchStart?: () => void;
  readonly accessibilityActions?: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

export function PostCard(props: PostCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { post } = props;
  const openUserProfile = useOpenUserProfile();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const openPostAuthorProfile = () =>
    post.author.id === signedInUserId || !props.onPressAuthor ? openUserProfile(post.author.id) : props.onPressAuthor();
  const hasMedia = post.media.length > 0;
  const isVisibleForAutoplay = useIsFeedItemVisibleForAutoplay(post.id);
  const isOwnPost = post.author.id === signedInUserId;
  const isMediaLockedForViewer = isContentLockedForViewer(post);
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [replySettingsPost, setReplySettingsPost] = useState<Post | null>(null);
  const [hasOpenedOptionsSheet, setHasOpenedOptionsSheet] = useState(false);
  const openMoreOptions =
    props.onPressMore ??
    (() => {
      setHasOpenedOptionsSheet(true);
      setIsOptionsSheetOpen(true);
    });
  const startBrandedDownload = useMediaDownloadStore((state) => state.startBrandedDownload);
  const canDownload = canOfferDownloadForPost(post);
  const downloadMedia = (media: Post["media"][number] | undefined) => {
    if (isDownloadableMedia(media)) requireAuthThen(() => startBrandedDownload(post.id, media), null, "download");
  };
  const optionActions = [
    ...(canDownload ? [{ label: "Download", icon: <BoxArrowDown24Icon size={20} />, onPress: () => downloadMedia(findFirstDownloadableMedia(post)) }] : []),
    ...(isOwnPost ? [{ label: "Edit reply settings", icon: <ReplyActionIcon size={20} />, onPress: () => setReplySettingsPost(post) }] : []),
  ];
  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const lastBodyTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    },
    [],
  );
  const likeFromDoubleTap = () => {
    setLikeBurstKey((key) => key + 1);
    if (!post.liked) props.onToggleLike?.();
  };
  const handleBodyPress = () => {
    const now = Date.now();
    if (now - lastBodyTapAt.current < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
      lastBodyTapAt.current = 0;
      likeFromDoubleTap();
      return;
    }
    lastBodyTapAt.current = now;
    if (props.onPress) {
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        props.onPress?.();
      }, DOUBLE_TAP_WINDOW_MS);
    }
  };
  return (
    <View style={styles.card}>
      <View style={styles.combo}>
        {post.friendsLiked ? (
          <View style={styles.likedBy}>
            <FriendsLikedAvatarStack avatarUrls={post.friendsLiked.avatars} avatarSize={24} overlapOffset={16} fallbackIcon={<Group1256Icon />} />
            <Text size={12} lineHeight={16.8}>
              {post.friendsLiked.count} friends liked
            </Text>
          </View>
        ) : null}
        <View style={styles.authorRow}>
          <Pressable accessibilityRole="button" onPress={openPostAuthorProfile} style={styles.author}>
            <Avatar uri={post.author.avatarUrl} size={32} />
            <View style={styles.nameRow}>
              <Text size={14} weight={500} lineHeight={16.8}>
                {post.author.name}
              </Text>
              <VerificationBadge verification={post.author.verification} legacyVerified={post.author.verified} size={16} />
              <View style={styles.dot} />
              <Text size={14} weight={500} lineHeight={16.8}>
                {formatTimeSincePosted(post.createdAt)}
              </Text>
              {post.sponsored ? <SponsoredLabel sponsored={post.sponsored} /> : null}
            </View>
          </Pressable>
          <View style={styles.authorActions}>
            {!post.isFollowingAuthor && props.onToggleFollow ? (
              <Pressable accessibilityRole="button" onPress={props.onToggleFollow} style={styles.follow}>
                <Text size={12} lineHeight={16.8} color={colors.white}>
                  Follow
                </Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={10} onPress={openMoreOptions}>
              <DotsThreeVertical24Icon />
            </Pressable>
          </View>
        </View>
      </View>

      <SensitiveContentGate postId={post.id} sensitive={post.sensitive} blurredPreviewUrl={post.media[0]?.posterUrl ?? post.media[0]?.url ?? null}>
      <Pressable
        onPress={handleBodyPress}
        disabled={!props.onPress && !props.onToggleLike}
        accessibilityRole="button"
        accessibilityLabel={props.onPress ? "Open post" : "Like post by double tap"}
        accessibilityHint="Double tap to like"
        accessibilityActions={props.accessibilityActions}
        onAccessibilityAction={props.onAccessibilityAction}
      >
        {post.isAiGenerated ? (
          <View style={styles.body}>
            <AiGeneratedLabel />
          </View>
        ) : null}
        {post.text ? (
          <View style={styles.body}>
            <MentionText text={post.text} mentions={post.mentions} size={14} lineHeight={16.8} />
          </View>
        ) : null}
        {post.resharedFrom ? (
          <ResharedPostBlock
            original={post.resharedFrom}
            onPressAuthor={() => openUserProfile(post.resharedFrom!.author.id)}
            onPress={props.onPressOriginalPost}
          />
        ) : null}
        {isMediaLockedForViewer ? (
          <View style={styles.lockedMedia}>
            <SubscriberOnlyLock
              creatorId={post.author.id}
              creatorName={post.author.name}
              blurredPreviewUrl={post.media[0]?.posterUrl ?? post.media[0]?.url ?? null}
            />
          </View>
        ) : hasMedia || post.products.length > 0 || post.sponsored?.adType === "carousel" ? (
          <SponsoredMedia sponsored={post.sponsored} placement={props.adPlacement ?? "feed"} itemId={post.id}>
            <View onTouchStart={props.onMediaPagerTouchStart}>
              <MediaPager
                media={post.media}
                overlay={post.replyToComment ? <CommentStickerOverlay clip={post} /> : undefined}
                isVisibleOnScreen={isVisibleForAutoplay}
                onPressViewProducts={post.products.length > 0 ? props.onPressViewProducts : undefined}
                saveTarget={saveTargetForPost(post)}
                savedAccordingToServer={post.bookmarked}
                onDownloadMedia={canDownload ? downloadMedia : undefined}
              />
            </View>
          </SponsoredMedia>
        ) : null}
        {!hasMedia && !isMediaLockedForViewer && post.products.length === 0 && !post.sponsored && !post.resharedFrom ? <PostLinkCard post={post} /> : null}
        {post.sponsored ? (
          <View style={styles.sponsoredCallToAction}>
            <SponsoredCallToAction sponsored={post.sponsored} placement={props.adPlacement ?? "feed"} itemId={post.id} />
          </View>
        ) : null}
        {post.resharedFromUnavailable ? (
          <View style={[styles.body, styles.unavailableQuote]}>
            <Text size={13} lineHeight={18} color={colors.textMuted}>This post isn't available.</Text>
          </View>
        ) : null}
      </Pressable>
      </SensitiveContentGate>
      <TaggedPeopleLine post={post} />

      <PostActionRow
        post={post}
        isOwnPost={isOwnPost}
        onToggleLike={props.onToggleLike}
        onPressComments={props.onPressComments}
        onRepost={props.onRepost}
        onShare={props.onShare}
        onPressAnalytics={props.onPressAnalytics}
        likePopKey={props.likePopKey}
      />
      <ViewQuotesLink post={post} />
      <LikeBurst burstKey={likeBurstKey} />
      {hasOpenedOptionsSheet ? (
        <ContentOptionsSheet
          target={
            isOptionsSheetOpen
              ? { targetType: "post", targetId: post.id, authorId: post.author.id, shareUrl: webAppLinks.post(post.id) }
              : null
          }
          onClose={() => setIsOptionsSheetOpen(false)}
          additionalActions={optionActions.length > 0 ? optionActions : undefined}
        />
      ) : null}
      {isOwnPost ? <ReplySettingsSheet post={replySettingsPost} onClose={() => setReplySettingsPost(null)} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 12,
    gap: 8,
  },
  combo: { gap: 4 },
  likedBy: { height: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 4 },
  authorRow: { height: 32, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.avatar },
  authorActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  follow: { height: 25, paddingHorizontal: 16, borderRadius: 4, backgroundColor: colors.primarySolid, justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingVertical: 8 },
  sponsoredCallToAction: { paddingHorizontal: 16, paddingTop: 8 },
  lockedMedia: { height: 335, overflow: "hidden" },
  unavailableQuote: { marginHorizontal: 16, borderWidth: 1, borderColor: colors.divider, borderRadius: 12 },
}));
