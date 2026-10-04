import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { LikeActionIcon, ReplyActionIcon } from "@/components/icons";
import { MentionText } from "@/components/mentions/mentionText";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { PreviewableImage } from "@/components/ui/previewableImage";
import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ThreadReply } from "@/types/postThread.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { PostActionButton } from "../postActionButton";

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
  readonly onReply: () => void;
  readonly onToggleLike: () => void;
  readonly onDelete: () => void;
}

export function ThreadReplyRow({ reply, hasParentAbove, hasChildBelow, showReplyingTo, isPending, canDelete, onReply, onToggleLike, onDelete }: ThreadReplyRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const openUserProfile = useOpenUserProfile();
  const firstImage = reply.media?.find((item) => item.type === "image" && item.url);
  const mediaAspect = firstImage?.width && firstImage.height ? firstImage.width / firstImage.height : 4 / 3;
  const confirmDelete = () =>
    showAlertWithButtons("Delete reply?", "This removes your reply and the replies under it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);

  return (
    <View
      style={[styles.row, isPending ? styles.pending : null]}
      accessible={false}
      accessibilityActions={canDelete ? [{ name: "delete", label: "Delete reply" }] : undefined}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === "delete" && confirmDelete()}
    >
      <View style={styles.rail}>
        <View style={[styles.lineAbove, hasParentAbove ? styles.line : null]} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${reply.author.name}'s profile`} onPress={() => openUserProfile(reply.author.id)}>
          <Avatar uri={reply.author.avatarUrl} size={THREAD_AVATAR_SIZE} />
        </Pressable>
        <View style={[styles.lineBelow, hasChildBelow ? styles.line : null]} />
      </View>
      <Pressable style={styles.content} onLongPress={canDelete ? confirmDelete : undefined} delayLongPress={400} accessible={false}>
        <View style={styles.meta}>
          <Text size={15} weight={600} lineHeight={19} numberOfLines={1} style={styles.name}>
            {reply.author.name}
          </Text>
          <VerificationBadge verification={reply.author.verification} legacyVerified={reply.author.verified} size={15} />
          {reply.isPostAuthor ? (
            <View style={styles.authorBadge} accessibilityLabel="Post author">
              <Text size={11} weight={600} lineHeight={14} color={colors.primary}>
                Author
              </Text>
            </View>
          ) : null}
          <Text size={14} lineHeight={19} color={colors.textMuted} numberOfLines={1} style={styles.handle}>
            @{reply.author.username} · {isPending ? "Posting" : formatTimeSincePosted(reply.createdAt)}
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
        <MentionText text={reply.text} mentions={reply.mentions} size={15} lineHeight={20} />
        {firstImage ? (
          <PreviewableImage imageUrl={firstImage.url} accessibilityLabel={`Image in ${reply.author.name}'s reply`} style={styles.mediaFrame}>
            <Image
              source={{ uri: firstImage.url ?? undefined }}
              style={[styles.media, { aspectRatio: mediaAspect, maxHeight: MAXIMUM_MEDIA_HEIGHT }]}
              contentFit="cover"
              transition={120}
            />
          </PreviewableImage>
        ) : null}
        <View style={styles.actions}>
          <PostActionButton
            label="Reply"
            tone="reply"
            count={reply.replyCount}
            onPress={isPending ? undefined : onReply}
            renderIcon={(ink) => <ReplyActionIcon size={ACTION_ICON_SIZE} color={ink} />}
          />
          <PostActionButton
            label={reply.liked ? "Unlike reply" : "Like reply"}
            tone="like"
            count={reply.likes}
            active={reply.liked}
            popOnActivate
            onPress={isPending ? undefined : onToggleLike}
            renderIcon={(ink) => <LikeActionIcon size={ACTION_ICON_SIZE} color={ink} filled={reply.liked} />}
          />
        </View>
      </Pressable>
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
    authorBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primaryTint },
    mediaFrame: { marginTop: 8, borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
    media: { width: "100%", backgroundColor: colors.media },
    actions: { flexDirection: "row", gap: 24, marginLeft: -2 },
  }),
);
