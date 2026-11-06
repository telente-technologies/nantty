import { MentionText } from "@/components/mentions/mentionText";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { palette } from "@/constants/colors.constant";
import { useTheme } from "@/theme";
import type { LiveComment } from "@/types";

import { useLiveForeground, type LiveForeground } from "./liveSurface.constant";

const FEED_MAX_HEIGHT = 232;
const FADED_ROW_OPACITIES = [0.35, 0.6, 0.85];

const describeSystemComment = (comment: LiveComment): string | null => {
  if (comment.kind === "joined") return "joined";
  if (comment.kind === "follow") return "followed the host";
  return null;
};

function CommentTextWithMentions({ text, ink, mentionInk }: { text: string; ink: string; mentionInk: string }) {
  return (
    <MentionText text={text} size={13} lineHeight={18} color={ink} mentionColor={mentionInk} />
  );
}

function SystemRow({ comment, foreground }: { comment: LiveComment; foreground: LiveForeground }) {
  return (
    <View style={[styles.systemRow, { backgroundColor: foreground.chip }]}>
      <Avatar uri={comment.author.avatarUrl} size={18} />
      <Text size={12} lineHeight={16} color={foreground.inkMuted} style={styles.flexText} numberOfLines={2}>
        <Text size={12} weight={600} lineHeight={16} color={foreground.ink}>
          {comment.author.username}
        </Text>{" "}
        {describeSystemComment(comment)}
      </Text>
    </View>
  );
}

function CommentRow({ comment, foreground, mentionInk }: { comment: LiveComment; foreground: LiveForeground; mentionInk: string }) {
  return (
    <View style={[styles.commentRow, { backgroundColor: foreground.chip }]}>
      <Avatar uri={comment.author.avatarUrl} size={26} />
      <View style={styles.flexText}>
        <View style={styles.nameRow}>
          <Text size={12} weight={600} lineHeight={16} color={foreground.inkMuted} numberOfLines={1} style={styles.shrink}>
            {comment.author.username}
          </Text>
          <VerificationBadge verification={comment.author.verification} legacyVerified={comment.author.verified} size={11} />
        </View>
        <CommentTextWithMentions text={comment.kind === "reply" ? `replied ${comment.text}` : comment.text} ink={foreground.ink} mentionInk={mentionInk} />
      </View>
    </View>
  );
}

export interface LiveCommentsFeedProps {
  readonly comments: readonly LiveComment[];
  readonly isShownOverVideo: boolean;
  readonly canLoadOlder?: boolean;
  readonly isLoadingOlder?: boolean;
  readonly olderError?: boolean;
  readonly onLoadOlder?: () => void;
  readonly onRetryOlder?: () => void;
}

export function LiveCommentsFeed({ comments, isShownOverVideo, canLoadOlder = false, isLoadingOlder = false, olderError = false, onLoadOlder, onRetryOlder }: LiveCommentsFeedProps) {
  const foreground = useLiveForeground(isShownOverVideo);
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  // The source is newest-first; inverted FlatList keeps the newest row at the bottom.
  const visibleComments = comments.filter((comment) => comment.kind !== "gift");
  const fadeStartsAt = visibleComments.length > 5 ? Math.max(0, visibleComments.length - 3) : visibleComments.length;
  const mentionInk = isShownOverVideo ? palette.primary[100] : colors.link;
  const renderComment = useCallback(({ item, index }: ListRenderItemInfo<LiveComment>) => {
    // The list is newest-first. Fade only the three oldest rows, preserving full
    // opacity for the newest comments at the bottom of the inverted list.
    const fadeIndex = visibleComments.length - 1 - index;
    const rowOpacity = index >= fadeStartsAt && fadeIndex >= 0 && fadeIndex < FADED_ROW_OPACITIES.length
      ? FADED_ROW_OPACITIES[fadeIndex]
      : 1;
    const isSystemRow = item.kind === "joined" || item.kind === "follow";
    return (
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(220)} style={{ opacity: rowOpacity }}>
        {isSystemRow ? <SystemRow comment={item} foreground={foreground} /> : <CommentRow comment={item} foreground={foreground} mentionInk={mentionInk} />}
      </Animated.View>
    );
  }, [fadeStartsAt, foreground, mentionInk, reduceMotion, visibleComments.length]);

  const historyControl = olderError ? (
    <Pressable accessibilityRole="button" onPress={onRetryOlder} style={styles.historyControl}>
      <Text size={11} color={foreground.inkMuted}>Couldn’t load earlier comments. Tap to retry.</Text>
    </Pressable>
  ) : isLoadingOlder ? (
    <View style={styles.historyControl}><ActivityIndicator size="small" color={foreground.inkMuted} /></View>
  ) : canLoadOlder ? (
    <Pressable accessibilityRole="button" onPress={onLoadOlder} style={styles.historyControl}>
      <Text size={11} color={foreground.inkMuted}>Scroll for earlier comments</Text>
    </Pressable>
  ) : undefined;

  return (
    <FlatList
      data={visibleComments}
      renderItem={renderComment}
      keyExtractor={(comment) => comment.id}
      inverted
      style={styles.feed}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Live comments"
      onEndReached={canLoadOlder ? onLoadOlder : undefined}
      onEndReachedThreshold={0.35}
      ListFooterComponent={historyControl}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  feed: { maxHeight: FEED_MAX_HEIGHT, flex: 1, maxWidth: 320 },
  content: { gap: 6, justifyContent: "flex-start", flexGrow: 1, alignItems: "flex-start" },
  historyControl: { minHeight: 28, justifyContent: "center", alignItems: "center", alignSelf: "stretch" },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4, paddingRight: 12, paddingVertical: 5, borderRadius: 16, maxWidth: "100%" },
  systemRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 999, maxWidth: "100%" },
  flexText: { flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  shrink: { flexShrink: 1 },
});
