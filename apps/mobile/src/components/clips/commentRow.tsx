import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { Heart20Icon, HeartFill72Icon } from "@/components/icons";
import { ReportSheet } from "@/components/moderation/reportSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Comment } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";

export interface CommentRowProps {
  readonly comment: Comment;
  readonly visualIndentLevel?: number;
  readonly showReplyingToPrefix?: boolean;
  readonly isPending?: boolean;
  readonly canDelete?: boolean;
  readonly onToggleLike: () => void;
  readonly onReply: () => void;
  readonly onDelete?: () => void;
}

const TOP_LEVEL_AVATAR_SIZE = 36;
const REPLY_AVATAR_SIZE = 28;

export function CommentRow({
  comment,
  visualIndentLevel = 0,
  showReplyingToPrefix,
  isPending,
  canDelete,
  onToggleLike,
  onReply,
  onDelete,
}: CommentRowProps) {
  const isReply = visualIndentLevel > 0;
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const offerToReportComment = () =>
    Alert.alert("Comment options", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Report comment", style: "destructive", onPress: () => setIsReportSheetOpen(true) },
    ]);
  const confirmDeletingOwnComment = () => {
    if (!canDelete || !onDelete) return;
    Alert.alert("Delete comment?", "This also removes the replies under it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };
  return (
    <Pressable
      onLongPress={canDelete ? confirmDeletingOwnComment : isPending ? undefined : offerToReportComment}
      accessibilityHint={canDelete ? "Long press to delete your comment" : "Long press to report this comment"}
      accessibilityActions={canDelete || isPending ? undefined : [{ name: "report", label: "Report comment" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "report") setIsReportSheetOpen(true);
      }}
      style={[styles.row, isPending && styles.pending]}
    >
      <Avatar uri={comment.author.avatarUrl} size={isReply ? REPLY_AVATAR_SIZE : TOP_LEVEL_AVATAR_SIZE} placeholderColor={colors.placeholder} />
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text size={12} weight={600} lineHeight={16.8}>
            {comment.author.username}
          </Text>
          <VerificationBadge verification={comment.author.verification} legacyVerified={comment.author.verified} size={12} />
          <Text size={12} weight={500} lineHeight={14.4} color={colors.textMuted}>
            {isPending ? "Posting…" : formatTimeSincePosted(comment.createdAt)}
          </Text>
        </View>
        <Text size={12} lineHeight={16.8}>
          {showReplyingToPrefix && comment.replyingTo ? (
            <Text size={12} weight={600} lineHeight={16.8} color={colors.primary}>
              {`@${comment.replyingTo.username} `}
            </Text>
          ) : null}
          {comment.text}
        </Text>
        {isPending ? null : (
          <Text size={12} weight={600} lineHeight={16.8} color={colors.textMuted} accessibilityRole="button" onPress={onReply}>
            Reply
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${comment.liked ? "Unlike" : "Like"} comment, ${comment.likes} likes`}
        hitSlop={8}
        disabled={isPending}
        onPress={onToggleLike}
        style={styles.like}
      >
        {comment.liked ? <HeartFill72Icon size={20} /> : <Heart20Icon />}
        <Text size={12} weight={600} lineHeight={16.8}>
          {formatCountWithThousandsSuffix(comment.likes)}
        </Text>
        {isReportSheetOpen ? (
        <ReportSheet target={{ targetType: "comment", targetId: comment.id }} onClose={() => setIsReportSheetOpen(false)} />
      ) : null}
    </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  pending: { opacity: 0.55 },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  like: { width: 32, gap: 4, alignItems: "center", alignSelf: "center" },
});
