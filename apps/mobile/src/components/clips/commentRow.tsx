import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { EyeSlash24Icon, Heart20Icon, HeartFill72Icon, PushPin24Icon, Trash24Icon, VideoCamera24Icon, Warning20Icon } from "@/components/icons";
import { MentionText } from "@/components/mentions/mentionText";
import { VideoReplyChip } from "./videoReply/videoReplyChip";
import { CommentQuotedPost } from "@/components/feed/commentQuotedPost";
import { ReportSheet } from "@/components/moderation/reportSheet";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { ActionSheet, type ActionSheetOption } from "@/components/ui/actionSheet";
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
  readonly canPin?: boolean;
  readonly canHide?: boolean;
  readonly onToggleLike: () => void;
  readonly onReply: () => void;
  readonly onDelete?: () => void;
  readonly onTogglePin?: () => void;
  readonly onHide?: () => void;
  readonly onReplyWithVideo?: () => void;
  readonly isPickingForVideoReply?: boolean;
  readonly isHighlighted?: boolean;
  readonly connectBelow?: boolean;
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
  canPin,
  onTogglePin,
  canHide,
  onHide,
  onReplyWithVideo,
  isPickingForVideoReply,
  isHighlighted,
  connectBelow,
}: CommentRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isReply = visualIndentLevel > 0;
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const openUserProfile = useOpenUserProfile();
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const offerToReportComment = () => setIsOptionsSheetOpen(true);
  const showsHide = !!canHide && !!onHide;
  const hasOwnerOptions = !!canDelete || !!canPin || showsHide;
  const askBeforeHiding = () =>
    showAlertWithButtons("Hide comment?", "Only you and the person who wrote it will see it. Replies under it are hidden too. You can unhide it from Settings, Hidden comments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Hide", onPress: () => onHide?.() },
    ]);
  const openCommentOptions = () => {
    if (!hasOwnerOptions) return;
    setIsOptionsSheetOpen(true);
  };
  const askBeforeDeleting = () =>
    showAlertWithButtons("Delete comment?", "This also removes the replies under it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
    ], { intent: "delete" });
  const commentOptions: ActionSheetOption[] = [
    ...(onReplyWithVideo ? [{ label: "Reply with video", icon: <VideoCamera24Icon size={20} color={colors.text} />, onPress: onReplyWithVideo }] : []),
    ...(canPin && onTogglePin
      ? [{
        label: comment.isPinned === true ? "Unpin comment" : "Pin comment",
        icon: <PushPin24Icon size={20} color={colors.text} />,
        onPress: onTogglePin,
      }]
      : []),
    ...(showsHide ? [{ label: "Hide comment", icon: <EyeSlash24Icon size={20} color={colors.text} />, onPress: askBeforeHiding }] : []),
    ...(canDelete && onDelete
      ? [{ label: "Delete comment", icon: <Trash24Icon size={20} />, destructive: true, onPress: askBeforeDeleting }]
      : [{ label: "Report comment", icon: <Warning20Icon />, destructive: true, onPress: () => requireAuthThen(() => setIsReportSheetOpen(true), undefined, "report") }]),
  ];
  return (
    <Pressable
      onPress={isPickingForVideoReply && onReplyWithVideo ? onReplyWithVideo : undefined}
      onLongPress={hasOwnerOptions ? openCommentOptions : isPending ? undefined : offerToReportComment}
      accessibilityHint={hasOwnerOptions ? "Long press for comment options" : "Long press to report this comment"}
      accessibilityActions={[
        ...(canDelete || isPending ? [] : [{ name: "report", label: "Report comment" }]),
        ...(onReplyWithVideo ? [{ name: "replyWithVideo", label: "Reply with video" }] : []),
        ...(canPin && onTogglePin ? [{ name: "togglePin", label: comment.isPinned === true ? "Unpin comment" : "Pin comment" }] : []),
        ...(showsHide ? [{ name: "hide", label: "Hide comment" }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "replyWithVideo") onReplyWithVideo?.();
        if (event.nativeEvent.actionName === "report") requireAuthThen(() => setIsReportSheetOpen(true), undefined, "report");
        if (event.nativeEvent.actionName === "togglePin") onTogglePin?.();
        if (event.nativeEvent.actionName === "hide") askBeforeHiding();
      }}
      style={[styles.row, isPending && styles.pending, isHighlighted && styles.highlighted, isPickingForVideoReply && onReplyWithVideo && styles.pickable]}
    >
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${comment.author.username}'s profile`} onPress={() => openUserProfile(comment.author.id)}>
          <Avatar uri={comment.author.avatarUrl} size={isReply ? REPLY_AVATAR_SIZE : TOP_LEVEL_AVATAR_SIZE} placeholderColor={colors.placeholder} />
        </Pressable>
        {connectBelow ? <View style={[styles.chainLine, { left: (isReply ? REPLY_AVATAR_SIZE : TOP_LEVEL_AVATAR_SIZE) / 2 - 1, top: (isReply ? REPLY_AVATAR_SIZE : TOP_LEVEL_AVATAR_SIZE) + 4 }]} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text size={12} weight={600} lineHeight={16.8} accessibilityRole="link" onPress={() => openUserProfile(comment.author.id)}>
            {comment.author.username}
          </Text>
          <VerificationBadge verification={comment.author.verification} legacyVerified={comment.author.verified} size={12} />
          {comment.isPostAuthor ? (
            <View style={styles.authorBadge} accessibilityLabel="Post author">
              <Text size={11} weight={600} lineHeight={14} color={colors.primary}>
                Author
              </Text>
            </View>
          ) : null}
          {comment.isPinned === true ? (
            <View style={styles.pinnedBadge} accessibilityLabel="Pinned by author">
              <PushPin24Icon size={12} color={colors.primary} />
              <Text size={12} weight={600} lineHeight={16.8} color={colors.primary}>
                Pinned by author
              </Text>
            </View>
          ) : null}
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
        <CommentQuotedPost comment={comment} />
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
        <ActionSheet visible={isOptionsSheetOpen} onClose={() => setIsOptionsSheetOpen(false)} title="Comment options" options={commentOptions} />
    </Pressable>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  pending: { opacity: 0.55 },
  pickable: { backgroundColor: colors.primaryTint, borderRadius: 8 },
  highlighted: { backgroundColor: colors.chip, borderRadius: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, gap: 4 },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  authorBadge: { paddingHorizontal: 6, borderRadius: 4, backgroundColor: colors.primaryTint },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  chainLine: { position: "absolute", bottom: -12, width: 2, borderRadius: 1, backgroundColor: colors.divider },
  like: { width: 32, gap: 4, alignItems: "center", alignSelf: "center" },
}));
