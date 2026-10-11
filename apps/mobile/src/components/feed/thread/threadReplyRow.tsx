import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { LikeActionIcon, BookmarkActionIcon, PushPin24Icon, ReplyActionIcon, RepostActionIcon, ShareActionIcon, Trash24Icon } from "@/components/icons";
import { MentionText } from "@/components/mentions/mentionText";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { ActionSheet, type ActionSheetOption } from "@/components/ui/actionSheet";
import { Avatar } from "@/components/ui/avatar";
import { PreviewableImage } from "@/components/ui/previewableImage";
import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { useSaveToggle } from "@/hooks/useSaveToggle.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { saveTargetForComment } from "@/types";
import type { ThreadReply } from "@/types/postThread.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { PostActionButton } from "../postActionButton";
import { CommentQuotedPost } from "../commentQuotedPost";

export const THREAD_AVATAR_SIZE = 40;
const ACTION_ICON_SIZE = 17;
const MAXIMUM_MEDIA_HEIGHT = 320;

export interface ThreadReplyRowProps {
  readonly reply: ThreadReply;
  readonly hasParentAbove: boolean;
  readonly hasChildBelow: boolean;
  readonly showReplyingTo: boolean;
  readonly isPending: boolean;
  readonly canDelete: boolean;
  readonly canPin?: boolean;
  readonly onTogglePin?: () => void;
  readonly onReply: () => void;
  readonly onToggleLike: () => void;
  readonly onRepost: () => void;
  readonly onShare: () => void;
  readonly onOpenThread: () => void;
  readonly onDelete: () => void;
}

export function ThreadReplyRow({ reply, hasParentAbove, hasChildBelow, showReplyingTo, isPending, canDelete, canPin = false, onTogglePin, onReply, onToggleLike, onRepost, onShare, onOpenThread, onDelete }: ThreadReplyRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const openUserProfile = useOpenUserProfile();
  const { isSaved, toggleSaved } = useSaveToggle(saveTargetForComment(reply), reply.bookmarked ?? false);
  const authorName = reply.author?.name ?? "Deleted user";
  const authorUsername = reply.author?.username ?? "deleted";
  const authorAvatarUrl = reply.author?.avatarUrl ?? null;
  const authorId = reply.author?.id;
  const firstImage = reply.media?.find((item) => item.type === "image" && item.url);
  const mediaAspect = firstImage?.width && firstImage.height ? firstImage.width / firstImage.height : 4 / 3;
  const confirmDelete = () =>
    showAlertWithButtons("Delete reply?", "This removes your reply and the replies under it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ], { intent: "delete" });
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const pinLabel = reply.isPinned === true ? "Unpin reply" : "Pin reply";
  const replyOptions: ActionSheetOption[] = [
    ...(canPin && onTogglePin ? [{ label: pinLabel, icon: <PushPin24Icon size={20} color={colors.text} />, onPress: onTogglePin }] : []),
    ...(canDelete ? [{ label: "Delete reply", icon: <Trash24Icon size={20} />, destructive: true, onPress: confirmDelete }] : []),
  ];

  return (
    <View
      style={[styles.row, isPending ? styles.pending : null]}
      accessible={false}
      accessibilityActions={replyOptions.length > 0 ? [...(canPin && onTogglePin ? [{ name: "togglePin", label: pinLabel }] : []), ...(canDelete ? [{ name: "delete", label: "Delete reply" }] : [])] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") confirmDelete();
        if (event.nativeEvent.actionName === "togglePin") onTogglePin?.();
      }}
    >
      <View style={styles.rail}>
        <View style={[styles.lineAbove, hasParentAbove ? styles.line : null]} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${authorName}'s profile`} onPress={() => (authorId ? openUserProfile(authorId) : undefined)}>
          <Avatar uri={authorAvatarUrl} size={THREAD_AVATAR_SIZE} />
        </Pressable>
        <View style={[styles.lineBelow, hasChildBelow ? styles.line : null]} />
      </View>
      <Pressable style={styles.content} onPress={isPending ? undefined : onOpenThread} onLongPress={replyOptions.length > 0 ? () => setIsOptionsSheetOpen(true) : undefined} delayLongPress={400} accessible={false}>
        <View style={styles.meta}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={1} style={styles.name}>
            {authorName}
          </Text>
          <VerificationBadge verification={reply.author?.verification ?? null} legacyVerified={reply.author?.verified ?? false} size={15} />
          {reply.isPostAuthor ? (
            <View style={styles.authorBadge} accessibilityLabel="Post author">
              <Text size={11} weight={600} lineHeight={14} color={colors.primary}>
                Author
              </Text>
            </View>
          ) : null}
          {reply.isPinned === true ? (
            <View style={styles.authorBadge} accessibilityLabel="Pinned by author">
              <PushPin24Icon size={11} color={colors.primary} />
              <Text size={11} weight={600} lineHeight={14} color={colors.primary}>
                Pinned by author
              </Text>
            </View>
          ) : null}
          <Text size={14} lineHeight={19} color={colors.textMuted} numberOfLines={1} style={styles.handle}>
            @{authorUsername} · {isPending ? "Posting" : reply.createdAt ? formatTimeSincePosted(reply.createdAt) : ""}
          </Text>
        </View>
        {showReplyingTo && reply.replyingTo ? (
          <Text size={13} lineHeight={17} color={colors.textMuted}>
            Replying to{" "}
            <Text size={13} lineHeight={17} color={colors.primary}>
              @{reply.replyingTo.username}
            </Text>
          </Text>
        ) : null}
        <MentionText text={reply.text ?? ""} mentions={reply.mentions} size={15} lineHeight={20} />
        <CommentQuotedPost comment={reply} />
        {firstImage ? (
          <PreviewableImage imageUrl={firstImage.url} accessibilityLabel={`Image in ${authorName}'s reply`} style={styles.mediaFrame}>
            <Image
              source={{ uri: firstImage.url ?? undefined }}
              style={[styles.media, { aspectRatio: mediaAspect, maxHeight: MAXIMUM_MEDIA_HEIGHT }]}
              contentFit="cover"
              transition={120}
            />
          </PreviewableImage>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.primaryActions}>
            <PostActionButton
              label="Reply"
              tone="reply"
              count={reply.replyCount ?? 0}
              onPress={isPending ? undefined : onReply}
              renderIcon={(ink) => <ReplyActionIcon size={ACTION_ICON_SIZE} color={ink} />}
            />
            <PostActionButton
              label="Repost reply"
              tone="repost"
              onPress={isPending ? undefined : onRepost}
              renderIcon={(ink) => <RepostActionIcon size={ACTION_ICON_SIZE} color={ink} />}
            />
            <PostActionButton
              label={reply.liked ? "Unlike reply" : "Like reply"}
              tone="like"
              count={reply.likes ?? 0}
              active={reply.liked ?? false}
              popOnActivate
              onPress={isPending ? undefined : onToggleLike}
              renderIcon={(ink) => <LikeActionIcon size={ACTION_ICON_SIZE} color={ink} filled={reply.liked ?? false} />}
            />
          </View>
          <View style={styles.secondaryActions}>
            <PostActionButton
              label={isSaved ? "Remove reply from saved" : "Save reply"}
              tone="bookmark"
              active={isSaved}
              popOnActivate
              onPress={isPending ? undefined : () => void toggleSaved()}
              renderIcon={(ink) => <BookmarkActionIcon size={ACTION_ICON_SIZE} color={ink} filled={isSaved} />}
            />
            <PostActionButton
              label="Share reply"
              tone="reply"
              onPress={isPending ? undefined : onShare}
              renderIcon={(ink) => <ShareActionIcon size={ACTION_ICON_SIZE} color={ink} />}
            />
          </View>
        </View>
      </Pressable>
      <ActionSheet visible={isOptionsSheetOpen} onClose={() => setIsOptionsSheetOpen(false)} title="Reply options" options={replyOptions} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    row: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
    pending: { opacity: 0.6 },
    rail: { width: THREAD_AVATAR_SIZE, alignItems: "center" },
    lineAbove: { width: 2, height: 12 },
    lineBelow: { width: 2, flex: 1, minHeight: 4, marginTop: 4 },
    line: { backgroundColor: colors.divider },
    content: { flex: 1, paddingTop: 12, paddingBottom: 4, gap: 4 },
    meta: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 20 },
    name: { flexShrink: 1 },
    handle: { flexShrink: 2 },
    authorBadge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primaryTint },
    mediaFrame: { marginTop: 8, borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    media: { width: "100%", backgroundColor: colors.media },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginLeft: -2, marginRight: 8 },
    primaryActions: { flexDirection: "row", alignItems: "center", gap: 20 },
    secondaryActions: { flexDirection: "row", alignItems: "center", gap: 0 },
  }),
);
