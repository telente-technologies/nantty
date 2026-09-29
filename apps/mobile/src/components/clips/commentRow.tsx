import { Pressable, StyleSheet, View } from "react-native";

import { Heart20Icon, HeartFill72Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { CommentWithReplies } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";


export interface CommentRowProps {
  readonly comment: CommentWithReplies;
  readonly onToggleLike: () => void;
  readonly onReply: () => void;
}

export function CommentRow({ comment, onToggleLike, onReply }: CommentRowProps) {
  return (
    <View style={styles.row}>
      <Avatar uri={comment.author.avatarUrl} size={36} placeholderColor={colors.placeholder} />
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text size={12} weight={600} lineHeight={16.8}>
            {comment.author.username}
          </Text>
          <Text size={12} weight={500} lineHeight={14.4} color={colors.textMuted}>
            {formatTimeSincePosted(comment.createdAt)}
          </Text>
        </View>
        <Text size={12} lineHeight={16.8}>
          {comment.text}
        </Text>
        <Text size={12} weight={600} lineHeight={16.8} accessibilityRole="button" onPress={onReply}>
          Reply
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${comment.liked ? "Unlike" : "Like"} comment, ${comment.likes} likes`}
        hitSlop={8}
        onPress={onToggleLike}
        style={styles.like}
      >
        {comment.liked ? <HeartFill72Icon size={20} /> : <Heart20Icon />}
        <Text size={12} weight={600} lineHeight={16.8}>
          {formatCountWithThousandsSuffix(comment.likes)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  like: { width: 32, gap: 4, alignItems: "center", alignSelf: "center" },
});
