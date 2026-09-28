import { Pressable, StyleSheet, View } from "react-native";

import { BrandLine24Icon, DotsThreeVertical24Icon, Group1256Icon, Heart24AltIcon, Refresh24Icon, Share24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Post } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/format-date.util";

import { MediaPager } from "./media-pager";

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
}

export function PostCard(props: PostCardProps) {
  const { post } = props;
  const hasMedia = post.media.length > 0;
  return (
    <View style={styles.card}>
      <View style={styles.combo}>
        {post.friendsLiked ? (
          <View style={styles.likedBy}>
            <Group1256Icon />
            <Text size={12} lineHeight={16.8}>
              {post.friendsLiked.count} friends liked
            </Text>
          </View>
        ) : null}
        <View style={styles.authorRow}>
          <Pressable accessibilityRole="button" onPress={props.onPressAuthor} style={styles.author}>
            <Avatar uri={post.author.avatarUrl} size={32} />
            <View style={styles.nameRow}>
              <Text size={14} weight={500} lineHeight={16.8}>
                {post.author.name}
              </Text>
              <View style={styles.dot} />
              <Text size={14} weight={500} lineHeight={16.8}>
                {formatTimeSincePosted(post.createdAt)}
              </Text>
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
            <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={10} onPress={props.onPressMore}>
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
        {hasMedia || post.products.length > 0 ? (
          <MediaPager media={post.media} onPressViewProducts={post.products.length > 0 ? props.onPressViewProducts : undefined} />
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
        </View>
      </View>
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
  interactions: { paddingHorizontal: 16, marginTop: 8 },
  counters: { flexDirection: "row", alignItems: "center", gap: 24 },
  counter: { flexDirection: "row", alignItems: "center", gap: 8 },
});
