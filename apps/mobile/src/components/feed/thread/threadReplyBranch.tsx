import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { isPendingComment, mergeServerAndLocalComments, useCommentThreadContext } from "@/components/clips/commentThreadController.hook";
import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ThreadReply } from "@/types/postThread.type";

import { toLocalThreadReply, useThreadReplies } from "./postThread.hook";
import { THREAD_AVATAR_SIZE, ThreadReplyRow } from "./threadReplyRow";

export interface ThreadReplyBranchProps {
  readonly reply: ThreadReply;
  readonly postAuthorId: string | undefined;
  readonly hasParentAbove: boolean;
  readonly showReplyingTo: boolean;
  readonly nestingLevel?: number;
}

export const MAXIMUM_THREAD_INDENT_LEVELS = 3;
const THREAD_INDENT_WIDTH = 20;

const describeShowRepliesLabel = (hiddenCount: number, isExpanded: boolean, isLoading: boolean) => {
  if (isLoading) return "Loading replies";
  if (isExpanded) return "Show more replies";
  return hiddenCount === 1 ? "Show 1 reply" : `Show ${hiddenCount} replies`;
};

export function ThreadReplyBranch({ reply, postAuthorId, hasParentAbove, showReplyingTo, nestingLevel = 0 }: ThreadReplyBranchProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const isAtIndentLimit = nestingLevel >= MAXIMUM_THREAD_INDENT_LEVELS;
  const childrenAreIndented = nestingLevel + 1 <= MAXIMUM_THREAD_INDENT_LEVELS;
  const isExpanded = thread.replyThreadVisibilityFor(reply.id) === "expanded";
  const { query, replies } = useThreadReplies(reply.id, isExpanded);
  if (thread.isCommentDeleted(reply.id)) return null;

  const serverChildren = isExpanded && query.data ? replies : reply.inlineReplies;
  const localChildren = thread.locallyPostedCommentsFor(reply.id).map((comment) => toLocalThreadReply(comment, postAuthorId, true));
  const visibleChildren = mergeServerAndLocalComments(serverChildren, localChildren, false).filter((child) => !thread.isCommentDeleted(child.id));
  const hiddenCount = Math.max(0, reply.replyCount - serverChildren.length);
  const opensThreadInstead = isAtIndentLimit && hiddenCount > 0 && !isExpanded && (reply.continuesInThread ?? true);
  const canShowMore = !opensThreadInstead && ((!isExpanded && hiddenCount > 0) || (isExpanded && (query.hasNextPage || query.isLoading)));
  const replyWithLocalChanges = thread.applyLocalOverridesToComment(reply);

  const expandOrLoadMore = () => {
    if (!isExpanded) thread.setReplyThreadVisibility(reply.id, "expanded");
    else if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage().catch(() => undefined);
  };

  return (
    <View>
      <ThreadReplyRow
        reply={replyWithLocalChanges}
        hasParentAbove={hasParentAbove}
        hasChildBelow={visibleChildren.length > 0 || canShowMore || opensThreadInstead}
        showReplyingTo={showReplyingTo}
        isPending={isPendingComment(reply)}
        canDelete={thread.canDeleteComment(reply)}
        onReply={() => thread.startReplyingToComment(reply)}
        onToggleLike={() => thread.toggleLikeOnComment(reply)}
        onDelete={() => thread.deleteOwnComment(reply)}
      />
      <View style={childrenAreIndented && visibleChildren.length > 0 ? styles.indented : null}>
        {visibleChildren.map((child, index) => (
          <ThreadReplyBranch
            key={child.id}
            reply={child}
            postAuthorId={postAuthorId}
            hasParentAbove={index === 0}
            showReplyingTo={!childrenAreIndented || index > 0}
            nestingLevel={nestingLevel + 1}
          />
        ))}
      </View>
      {opensThreadInstead ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View thread, ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"} to ${reply.author.name}`}
          onPress={() => navigation.navigate("CommentThread", { commentId: reply.id, postId: reply.postId })}
          style={styles.showMore}
        >
          <View style={styles.rail}>
            <View style={[styles.railDot, { backgroundColor: colors.divider }]} />
          </View>
          <Text size={14} weight={500} lineHeight={18} color={colors.primary}>
            View thread
          </Text>
        </Pressable>
      ) : null}
      {canShowMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={describeShowRepliesLabel(hiddenCount, isExpanded, query.isFetching)}
          onPress={expandOrLoadMore}
          disabled={query.isFetching}
          style={styles.showMore}
        >
          <View style={styles.rail}>
            {visibleChildren.length === 0 ? <View style={styles.railLine} /> : null}
            <View style={[styles.railDot, { backgroundColor: colors.divider }]} />
          </View>
          {query.isFetching && isExpanded ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Text size={14} weight={500} lineHeight={18} color={colors.primary}>
            {describeShowRepliesLabel(hiddenCount, isExpanded, query.isFetching && isExpanded)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    showMore: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 44 },
    rail: { width: THREAD_AVATAR_SIZE, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
    railLine: { position: "absolute", top: 0, height: "50%", width: 2, backgroundColor: colors.divider },
    railDot: { width: 6, height: 6, borderRadius: 3 },
    indented: { marginLeft: THREAD_INDENT_WIDTH },
  }),
);
