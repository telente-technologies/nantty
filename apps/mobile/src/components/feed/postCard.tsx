import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BrandLine24Icon, DotsThreeVertical24Icon, Group1256Icon, Heart24AltIcon, Refresh24Icon, Share24Icon } from "@/components/icons";
import { isContentLockedForViewer, SubscriberOnlyLock } from "@/components/coins/subscriberOnlyLock";
import { TipSheet, type TipTarget } from "@/components/coins/tipSheet";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { FriendsLikedAvatarStack } from "@/components/feed/friendsLikedAvatarStack";
import { Avatar } from "@/components/ui/avatar";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useAuthStore } from "@/store/auth.store";
import type { AdPlacement, Post } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";

import { useIsFeedItemVisibleForAutoplay } from "./feedVisibility.hook";
import { MediaPager } from "./mediaPager";
import { SponsoredCallToAction, SponsoredLabel } from "./sponsoredContent";
import { CoinAmountWithIcon } from "@/components/coins/coinAmount";

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
  readonly onPress?: () => void;
  readonly adPlacement?: AdPlacement;
}

export function PostCard(props: PostCardProps) {
  const { post } = props;
  const openUserProfile = useOpenUserProfile();
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const openPostAuthorProfile = () =>
    post.author.id === signedInUserId || !props.onPressAuthor ? openUserProfile(post.author.id) : props.onPressAuthor();
  const hasMedia = post.media.length > 0;
  const isVisibleForAutoplay = useIsFeedItemVisibleForAutoplay(post.id);
  const [tipTarget, setTipTarget] = useState<TipTarget | null>(null);
  const canTipAuthor = post.author.isCreator === true && post.author.id !== signedInUserId;
  const isMediaLockedForViewer = isContentLockedForViewer(post);
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [hasOpenedOptionsSheet, setHasOpenedOptionsSheet] = useState(false);
  const openMoreOptions =
    props.onPressMore ??
    (() => {
      setHasOpenedOptionsSheet(true);
      setIsOptionsSheetOpen(true);
    });
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

      <Pressable onPress={props.onPress} disabled={!props.onPress}>
        {post.text ? (
          <View style={styles.body}>
            <Text size={14} lineHeight={16.8}>
              {post.text}
            </Text>
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
        ) : hasMedia || post.products.length > 0 ? (
          <MediaPager
            media={post.media}
            isVisibleOnScreen={isVisibleForAutoplay}
            onPressViewProducts={post.products.length > 0 ? props.onPressViewProducts : undefined}
          />
        ) : null}
        {post.sponsored ? (
          <View style={styles.sponsoredCallToAction}>
            <SponsoredCallToAction sponsored={post.sponsored} placement={props.adPlacement ?? "feed"} itemId={post.id} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.interactions}>
        <View style={styles.counters}>
          <Counter label="Like" count={post.likes} onPress={props.onToggleLike}>
            <Heart24AltIcon color={post.liked ? colors.error : undefined} />
          </Counter>
          <Counter label="Comments" count={post.comments} onPress={props.onPressComments}>
            <BrandLine24Icon />
          </Counter>
          <Counter label="Repost" count={post.reposts} onPress={props.onRepost}>
            <Refresh24Icon />
          </Counter>
          <Pressable accessibilityRole="button" accessibilityLabel="Share" hitSlop={8} onPress={props.onShare}>
            <Share24Icon />
          </Pressable>
          {canTipAuthor ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tip ${post.author.name} with coins`}
              hitSlop={8}
              onPress={() => setTipTarget({ targetType: "post", targetId: post.id, creatorName: post.author.name })}
            >
              <CoinAmountWithIcon weight={500} label="Tip" />
            </Pressable>
          ) : null}
        </View>
        {tipTarget ? <TipSheet target={tipTarget} onClose={() => setTipTarget(null)} /> : null}
      </View>
      {hasOpenedOptionsSheet ? (
        <ContentOptionsSheet
          target={
            isOptionsSheetOpen
              ? { targetType: "post", targetId: post.id, authorId: post.author.id, shareUrl: `https://zudomart.com/posts/${post.id}` }
              : null
          }
          onClose={() => setIsOptionsSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

function Counter({ label, count, onPress, children }: { label: string; count: number; onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${count}`} hitSlop={6} onPress={onPress} style={styles.counter}>
      {children}
      <Text size={14} weight={500} lineHeight={16.8}>
        {formatCountWithThousandsSuffix(count)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
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
  follow: { height: 25, paddingHorizontal: 16, borderRadius: 4, backgroundColor: colors.primary, justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingVertical: 8 },
  sponsoredCallToAction: { paddingHorizontal: 16, paddingTop: 8 },
  interactions: { paddingHorizontal: 16, marginTop: 8 },
  counters: { flexDirection: "row", alignItems: "center", gap: 24 },
  lockedMedia: { height: 335, overflow: "hidden" },
  counter: { flexDirection: "row", alignItems: "center", gap: 8 },
});
