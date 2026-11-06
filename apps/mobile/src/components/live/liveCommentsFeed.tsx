import { MentionText } from "@/components/mentions/mentionText";
import { useRef } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { palette } from "@/constants/colors.constant";
import { useTheme } from "@/theme";
import type { LiveComment } from "@/types";

import { useLiveForeground, type LiveForeground } from "./liveSurface.constant";

const VISIBLE_COMMENT_COUNT = 12;
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
}

export function LiveCommentsFeed({ comments, isShownOverVideo }: LiveCommentsFeedProps) {
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const foreground = useLiveForeground(isShownOverVideo);
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const visibleComments = comments.filter((comment) => comment.kind !== "gift").slice(-VISIBLE_COMMENT_COUNT);
  const fadeStartsAt = visibleComments.length > 5 ? 0 : FADED_ROW_OPACITIES.length;
  const mentionInk = isShownOverVideo ? palette.primary[100] : colors.link;
  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.feed}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Live comments"
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: !reduceMotion })}
    >
      {visibleComments.map((comment, index) => {
        const rowOpacity = index >= fadeStartsAt && index < FADED_ROW_OPACITIES.length ? FADED_ROW_OPACITIES[index] : 1;
        const isSystemRow = comment.kind === "joined" || comment.kind === "follow";
        return (
          <Animated.View key={comment.id} entering={reduceMotion ? undefined : FadeInDown.duration(220)} style={{ opacity: rowOpacity }}>
            {isSystemRow ? <SystemRow comment={comment} foreground={foreground} /> : <CommentRow comment={comment} foreground={foreground} mentionInk={mentionInk} />}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feed: { maxHeight: FEED_MAX_HEIGHT, flex: 1, maxWidth: 320 },
  content: { gap: 6, justifyContent: "flex-end", flexGrow: 1, alignItems: "flex-start" },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4, paddingRight: 12, paddingVertical: 5, borderRadius: 16, maxWidth: "100%" },
  systemRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 999, maxWidth: "100%" },
  flexText: { flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  shrink: { flexShrink: 1 },
});
