import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { isPendingComment, mergeServerAndLocalComments, useCommentThreadContext } from "@/components/clips/commentThreadController.hook";
import { Text } from "@/components/ui/text";
import { webAppLinks } from "@/config/webAppLinks.config";
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
  readonly onRepostReply?: (reply: ThreadReply) => void;
}

export const MAXIMUM_THREAD_INDENT_LEVELS = 3;
const THREAD_INDENT_WIDTH = 20;

const describeShowRepliesLabel = (hiddenCount: number, isExpanded: boolean, isLoading: boolean, hasVisibleReplies = false) => {
  if (isLoading) return "Loading replies";
  if (isExpanded) return "Show more replies";
  return `Show ${hiddenCount}${hasVisibleReplies ? " more" : ""} ${hiddenCount === 1 ? "reply" : "replies"}`;
};

export function ThreadReplyBranch({ reply, postAuthorId, hasParentAbove, showReplyingTo, nestingLevel = 0, onRepostReply }: ThreadReplyBranchProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const isAtIndentLimit = nestingLevel >= MAXIMUM_THREAD_INDENT_LEVELS;
  const childrenAreIndented = nestingLevel + 1 <= MAXIMUM_THREAD_INDENT_LEVELS;
  const isExpanded = thread.replyThreadVisibilityFor(reply.id) === "expanded";
  const { query, replies } = useThreadReplies(reply.id, isExpanded);
  if (thread.isCommentDeleted(reply.id)) return null;

  const serverChildren = isExpanded && query.data ? replies : (reply.inlineReplies ?? []);
  const localChildren = thread.locallyPostedCommentsFor(reply.id).map((comment) => toLocalThreadReply(comment, postAuthorId, true));
  const visibleChildren = mergeServerAndLocalComments(serverChildren, localChildren, false).filter((child) => !thread.isCommentDeleted(child.id));
  const hiddenCount = Math.max(0, (reply.replyCount ?? 0) - serverChildren.length);
  const opensThreadInstead = hiddenCount > 0 && !isExpanded && (isAtIndentLimit ? (reply.continuesInThread ?? true) : reply.continuesInThread === true);
  const continuesAsChain = visibleChildren.length === 1 && !isExpanded;
  const canShowMore = !opensThreadInstead && ((!isExpanded && hiddenCount > 0) || (isExpanded && (query.hasNextPage || query.isLoading)));
  const replyWithLocalChanges = thread.applyLocalOverridesToComment(reply);

  const expandOrLoadMore = () => {
    if (!isExpanded) thread.setReplyThreadVisibility(reply.id, "expanded");
    else if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage().catch(() => undefined);
  };

  const shareReply = () => {
    Share.share({ message: `${reply.author?.name ?? "Someone"} on Zudomart: ${webAppLinks.post(reply.postId)}#${reply.id}` }).catch(() => undefined);
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
        canPin={thread.canPinComment(reply)}
        onTogglePin={() => thread.togglePinOnComment(reply)}
        canHide={thread.canHideComment(reply)}
        onHide={() => thread.hideComment(reply)}
        onReply={() => thread.startReplyingToComment(reply)}
        onToggleLike={() => thread.toggleLikeOnComment(reply)}
        onRepost={() => onRepostReply?.(reply)}
        onShare={shareReply}
        onOpenThread={() => navigation.navigate("CommentThread", { commentId: reply.id, postId: reply.postId })}
        onDelete={() => thread.deleteOwnComment(reply)}
      />
      <View style={childrenAreIndented && !continuesAsChain && visibleChildren.length > 0 ? styles.indented : null}>
        {visibleChildren.map((child, index) => (
          <ThreadReplyBranch
            key={child.id}
            reply={child}
            postAuthorId={postAuthorId}
            hasParentAbove={index === 0}
            showReplyingTo={!continuesAsChain && (!childrenAreIndented || index > 0)}
            nestingLevel={continuesAsChain ? nestingLevel : nestingLevel + 1}
            onRepostReply={onRepostReply}
          />
        ))}
      </View>
      {opensThreadInstead ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View thread, ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"} to ${reply.author?.name ?? "this reply"}`}
          onPress={() => navigation.navigate("CommentThread", { commentId: reply.id, postId: reply.postId })}
          style={styles.showMore}
        >
          <View style={styles.rail}>
            <View style={[styles.railDot, { backgroundColor: colors.divider }]} />
          </View>
          <Text size={14} weight={500} lineHeight={18} color={colors.primary}>
            View thread
          </Text>
          <CaretRight24Icon size={20} color={colors.primary} />
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
            {describeShowRepliesLabel(hiddenCount, isExpanded, query.isFetching && isExpanded, visibleChildren.length > 0)}
          </Text>
          <CaretRight24Icon size={20} color={colors.primary} />
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
