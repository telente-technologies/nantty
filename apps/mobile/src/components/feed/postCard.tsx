import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from "react-native";

import { ExpandableText } from "@/components/ui/expandableText";
import { Bell24Icon, BellSlash24Icon, BoxArrowDown24Icon, DotsThreeVertical24Icon, Group1256Icon, PushPin24Icon, ReplyActionIcon, Trash24Icon } from "@/components/icons";
import { isContentLockedForViewer, SubscriberOnlyLock } from "@/components/coins/subscriberOnlyLock";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { FriendsLikedAvatarStack } from "@/components/feed/friendsLikedAvatarStack";
import { Avatar } from "@/components/ui/avatar";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useAuthStore } from "@/store/auth.store";
import type { AdPlacement, Post } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { useIsFeedItemVisibleForAutoplay } from "./feedVisibility.hook";
import { CommentStickerOverlay } from "@/components/clips/videoReply/commentStickerOverlay";
import { MediaPager } from "./mediaPager";
import { PostActionRow } from "./postActionRow";
import { PostCardFallbackActions, type PostCardFallbackRequest } from "./postCardFallbackActions";
import { usePinPostMutation } from "./usePinPost.hook";
import { useDeleteOwnPost } from "./useDeleteOwnPost.hook";
import { postNotificationMuteLabel, usePostNotificationMute } from "./postNotificationMute.hook";
import { canOfferPostNotificationMute } from "@/utils/postNotificationMute.util";
import { ReplySettingsSheet } from "./replySettingsSheet";
import { SensitiveContentGate } from "./sensitiveContentGate";
import { QuotedPostCard } from "./quotedPostCard";
import { quotedSummaryFromPost } from "@/utils/postLinks.util";
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
import { useIsOwnPost } from "@/hooks/useIsOwnPost.hook";
import { feedInteractionsService, interactionTargetOf, type FeedInteractionSurface } from "@/services/feed/feedInteractions.service";

import { PostSurfaceProvider, usePostSurface } from "./interactions/postSurface.context";
import { usePostImpressionTracking } from "./interactions/usePostImpressionTracking.hook";

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
  readonly showPinnedBadge?: boolean;
  readonly onPressViewProducts?: () => void;
  readonly onPressAnalytics?: () => void;
  readonly onPress?: () => void;
  readonly onPressOriginalPost?: () => void;
  readonly adPlacement?: AdPlacement;
  readonly likePopKey?: number;
  readonly onMediaPagerTouchStart?: () => void;
  readonly accessibilityActions?: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  readonly position?: number;
  readonly surface?: FeedInteractionSurface;
}

export function PostCard(props: PostCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { post } = props;
  const openUserProfile = useOpenUserProfile();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const contextSurface = usePostSurface();
  const surface = props.surface ?? contextSurface;
  const canSeeAnalytics = useIsOwnPost(post);
  const interactionTarget = useMemo(() => interactionTargetOf(post), [post]);
  const impressionRef = usePostImpressionTracking(canSeeAnalytics ? null : interactionTarget, surface, props.position);
  const openPostAuthorProfile = () => {
    feedInteractionsService.recordProfileClick(interactionTarget, surface);
    if (post.author.id === signedInUserId || !props.onPressAuthor) openUserProfile(post.author.id);
    else props.onPressAuthor();
  };
  const followAuthorFromPost = () => {
    feedInteractionsService.recordFollow(interactionTarget, surface);
    props.onToggleFollow?.();
  };
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
  const pinMutation = usePinPostMutation();
  const { confirmAndDelete } = useDeleteOwnPost();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const { togglePostLike } = usePostInteractions();
  const [fallbackRequest, setFallbackRequest] = useState<PostCardFallbackRequest | null>(null);
  const requestFallback = (kind: PostCardFallbackRequest["kind"]) => setFallbackRequest((current) => ({ kind, nonce: (current?.nonce ?? 0) + 1 }));
  const onToggleLike = props.onToggleLike ?? (() => togglePostLike(post));
  const onPressComments = props.onPressComments ?? (() => navigation.navigate("PostDetail", { postId: post.id }));
  const onRepost = props.onRepost ?? (() => requestFallback("repost"));
  const onShare = props.onShare ?? (() => requestFallback("share"));
  const onPressViewProducts = props.onPressViewProducts ?? (() => requestFallback("products"));
  const onPressAnalytics = props.onPressAnalytics ?? (() => navigation.navigate("PostAnalytics", { postId: post.id }));
  const resharedFromId = post.resharedFrom?.id;
  const onPressOriginalPost = props.onPressOriginalPost ?? (resharedFromId ? () => navigation.navigate("PostDetail", { postId: resharedFromId }) : undefined);
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const { togglePostNotifications } = usePostNotificationMute();
  const optionActions = [
    ...(canDownload ? [{ label: "Download", icon: <BoxArrowDown24Icon size={20} />, onPress: () => downloadMedia(findFirstDownloadableMedia(post)) }] : []),
    ...(isOwnPost ? [{ label: "Edit reply settings", icon: <ReplyActionIcon size={20} />, onPress: () => setReplySettingsPost(post) }] : []),
    ...(isOwnPost
      ? [{
        label: post.isPinned === true ? "Unpin from profile" : "Pin to profile",
        icon: <PushPin24Icon size={20} color={colors.text} />,
        onPress: () => pinMutation.mutate(post),
      }]
      : []),
    ...(canSeeAnalytics ? [{ label: "Delete", icon: <Trash24Icon size={20} />, destructive: true, onPress: () => confirmAndDelete({ id: post.id, kind: post.kind ?? "post" }) }] : []),
    ...(canOfferPostNotificationMute(isSignedIn, post)
      ? [{
        label: postNotificationMuteLabel(post.viewerNotificationsMuted === true),
        icon: post.viewerNotificationsMuted === true ? <Bell24Icon size={20} color={colors.text} /> : <BellSlash24Icon size={20} color={colors.text} />,
        onPress: () => togglePostNotifications(post),
      }]
      : []),
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
    if (!post.liked) onToggleLike();
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
    <PostSurfaceProvider surface={surface}>
    <View ref={impressionRef} collapsable={false} style={styles.card}>
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
            <View>
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
                {props.showPinnedBadge === true && post.isPinned === true ? (
                  <View style={styles.pinnedBadge} accessibilityLabel="Pinned post">
                    <PushPin24Icon size={12} color={colors.primary} />
                    <Text size={12} weight={600} lineHeight={16.8} color={colors.primary}>
                      Pinned
                    </Text>
                  </View>
                ) : null}
              </View>
              {post.postedAs ? (
                <Text size={12} lineHeight={16} color={colors.textMuted}>
                  Posted as {post.postedAs.name} · @{post.postedAs.handle}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.authorActions}>
            {!post.isFollowingAuthor && props.onToggleFollow ? (
              <Pressable accessibilityRole="button" onPress={followAuthorFromPost} style={styles.follow}>
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
            <ExpandableText text={post.text} mentions={post.mentions} size={14} lineHeight={16.8} />
          </View>
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
                onPressViewProducts={post.products.length > 0 ? onPressViewProducts : undefined}
                saveTarget={saveTargetForPost(post)}
                savedAccordingToServer={post.bookmarked}
                onDownloadMedia={canDownload ? downloadMedia : undefined}
                look={post.look}
                watermarkHandle={post.author.username}
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
        {post.resharedFrom || post.resharedFromUnavailable ? (
          <View style={styles.quote}>
            <QuotedPostCard quoted={post.resharedFrom ? quotedSummaryFromPost(post.resharedFrom) : null} unavailable={!post.resharedFrom} onPress={onPressOriginalPost} />
          </View>
        ) : null}
      </Pressable>
      </SensitiveContentGate>
      <TaggedPeopleLine post={post} />

      <PostActionRow
        post={post}
        isOwnPost={canSeeAnalytics}
        onToggleLike={onToggleLike}
        onPressComments={onPressComments}
        onRepost={onRepost}
        onShare={onShare}
        onPressAnalytics={onPressAnalytics}
        likePopKey={props.likePopKey}
      />
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
      {fallbackRequest ? <PostCardFallbackActions post={post} request={fallbackRequest} /> : null}
      {isOwnPost ? <ReplySettingsSheet post={replySettingsPost} onClose={() => setReplySettingsPost(null)} /> : null}
    </View>
    </PostSurfaceProvider>
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
  authorRow: { minHeight: 32, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.avatar },
  authorActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  follow: { height: 25, paddingHorizontal: 16, borderRadius: 4, backgroundColor: colors.primarySolid, justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingVertical: 8 },
  sponsoredCallToAction: { paddingHorizontal: 16, paddingTop: 8 },
  lockedMedia: { height: 335, overflow: "hidden" },
  quote: { paddingTop: 8 },
}));
