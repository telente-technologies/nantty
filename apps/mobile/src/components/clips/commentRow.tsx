import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Heart20Icon, HeartFill72Icon, VideoCamera24Icon } from "@/components/icons";
import { MentionText } from "@/components/mentions/mentionText";
import { VideoReplyChip } from "./videoReply/videoReplyChip";
import { ReportSheet } from "@/components/moderation/reportSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Comment } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

export interface CommentRowProps {
  readonly comment: Comment;
  readonly visualIndentLevel?: number;
  readonly showReplyingToPrefix?: boolean;
  readonly isPending?: boolean;
  readonly canDelete?: boolean;
  readonly onToggleLike: () => void;
  readonly onReply: () => void;
  readonly onDelete?: () => void;
  readonly onReplyWithVideo?: () => void;
  readonly isPickingForVideoReply?: boolean;
  readonly isHighlighted?: boolean;
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
  onReplyWithVideo,
  isPickingForVideoReply,
  isHighlighted,
}: CommentRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isReply = visualIndentLevel > 0;
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const openUserProfile = useOpenUserProfile();
  const offerToReportComment = () =>
    showAlertWithButtons("Comment options", undefined, [
      { text: "Cancel", style: "cancel" },
      ...(onReplyWithVideo ? [{ text: "Reply with video", onPress: onReplyWithVideo }] : []),
      { text: "Report comment", style: "destructive", onPress: () => requireAuthThen(() => setIsReportSheetOpen(true), undefined, "report") },
    ]);
  const confirmDeletingOwnComment = () => {
    if (!canDelete || !onDelete) return;
    showAlertWithButtons("Delete comment?", "This also removes the replies under it.", [
      { text: "Cancel", style: "cancel" },
      ...(onReplyWithVideo ? [{ text: "Reply with video", onPress: onReplyWithVideo }] : []),
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };
  return (
    <Pressable
      onPress={isPickingForVideoReply && onReplyWithVideo ? onReplyWithVideo : undefined}
      onLongPress={canDelete ? confirmDeletingOwnComment : isPending ? undefined : offerToReportComment}
      accessibilityHint={canDelete ? "Long press to delete your comment" : "Long press to report this comment"}
      accessibilityActions={[
        ...(canDelete || isPending ? [] : [{ name: "report", label: "Report comment" }]),
        ...(onReplyWithVideo ? [{ name: "replyWithVideo", label: "Reply with video" }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "replyWithVideo") onReplyWithVideo?.();
        if (event.nativeEvent.actionName === "report") requireAuthThen(() => setIsReportSheetOpen(true), undefined, "report");
      }}
      style={[styles.row, isPending && styles.pending, (isHighlighted || (isPickingForVideoReply && onReplyWithVideo)) && styles.pickable]}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`${comment.author.username}'s profile`} onPress={() => openUserProfile(comment.author.id)}>
        <Avatar uri={comment.author.avatarUrl} size={isReply ? REPLY_AVATAR_SIZE : TOP_LEVEL_AVATAR_SIZE} placeholderColor={colors.placeholder} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text size={12} weight={600} lineHeight={16.8} accessibilityRole="link" onPress={() => openUserProfile(comment.author.id)}>
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
          <MentionText text={comment.text} mentions={comment.mentions} size={12} lineHeight={16.8} />
        </Text>
        {isPending ? null : (
          <View style={styles.actions}>
            <Text size={12} weight={600} lineHeight={16.8} color={colors.textMuted} accessibilityRole="button" onPress={onReply}>
              Reply
            </Text>
            {onReplyWithVideo ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Reply with video" hitSlop={8} onPress={onReplyWithVideo}>
                <VideoCamera24Icon size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        )}
        {comment.videoReplies?.[0] ? <VideoReplyChip reply={comment.videoReplies[0]} /> : null}
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

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  pending: { opacity: 0.55 },
  pickable: { backgroundColor: colors.primaryTint, borderRadius: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  like: { width: 32, gap: 4, alignItems: "center", alignSelf: "center" },
}));
