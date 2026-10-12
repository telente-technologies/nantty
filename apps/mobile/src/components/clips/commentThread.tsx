import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Comment } from "@/types";

import { countRepliesHiddenFromChain } from "@/utils/commentChain.util";

import { CommentRow } from "./commentRow";
import { isPendingComment, mergeServerAndLocalComments, useCommentThreadContext } from "./commentThreadController.hook";
import { useRepliesForComment } from "./postComments.hook";

const MAXIMUM_VISUAL_INDENT_LEVEL = 2;
const INDENT_WIDTH_PER_LEVEL = 44;

export interface CommentThreadProps {
  readonly comment: Comment;
  readonly nestingDepth: number;
  readonly previewReplies?: readonly Comment[];
}

const describeHiddenReplyCount = (hiddenReplyCount: number, alreadyShowingSomeReplies: boolean) => {
  const noun = hiddenReplyCount === 1 ? "reply" : "replies";
  return alreadyShowingSomeReplies ? `View ${hiddenReplyCount} more ${noun}` : `View ${hiddenReplyCount} ${noun}`;
};

export function CommentThread({ comment, nestingDepth, previewReplies = [] }: CommentThreadProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const visibility = thread.replyThreadVisibilityFor(comment.id);
  const isExpanded = visibility === "expanded";
  const isCollapsed = visibility === "collapsed";
  const { query: repliesQuery, loadedReplies } = useRepliesForComment(comment.id, isExpanded);

  if (thread.isCommentDeleted(comment.id)) return null;
  if (nestingDepth === 0 && !isExpanded && !isCollapsed && previewReplies.length > 0) {
    return <CommentChain comment={comment} previewReplies={previewReplies} onShowMore={() => thread.setReplyThreadVisibility(comment.id, "expanded")} />;
  }

  const commentWithLocalChanges = thread.applyLocalOverridesToComment(comment);
  const visualIndentLevel = Math.min(nestingDepth, MAXIMUM_VISUAL_INDENT_LEVEL);
  const repliesFromServerShown = isExpanded && repliesQuery.data ? loadedReplies : isCollapsed ? [] : previewReplies;
  const visibleReplies = isCollapsed
    ? []
    : mergeServerAndLocalComments(repliesFromServerShown, thread.locallyPostedCommentsFor(comment.id), false).filter(
        (reply) => !thread.isCommentDeleted(reply.id),
      );
  const hiddenReplyCount = isCollapsed
    ? comment.replyCount + thread.locallyPostedCommentsFor(comment.id).length
    : Math.max(0, comment.replyCount - repliesFromServerShown.length);
  const canLoadMoreExpandedReplies = isExpanded && (repliesQuery.hasNextPage || repliesQuery.isLoading);
  const showViewMoreLink = hiddenReplyCount > 0 && !isExpanded;
  const showHideLink = visibleReplies.length > 0 && (isExpanded || previewReplies.length > 0);

  const expandOrLoadMoreReplies = () => {
    if (!isExpanded) thread.setReplyThreadVisibility(comment.id, "expanded");
    else if (repliesQuery.hasNextPage && !repliesQuery.isFetchingNextPage) repliesQuery.fetchNextPage().catch(() => undefined);
  };

  return (
    <View style={styles.thread}>
      <View style={{ paddingLeft: visualIndentLevel * INDENT_WIDTH_PER_LEVEL }}>
        <CommentRow
          comment={commentWithLocalChanges}
          visualIndentLevel={visualIndentLevel}
          showReplyingToPrefix={nestingDepth > MAXIMUM_VISUAL_INDENT_LEVEL}
          isPending={isPendingComment(comment)}
          canDelete={thread.canDeleteComment(comment)}
          canPin={thread.canPinComment(commentWithLocalChanges)}
          onToggleLike={() => thread.toggleLikeOnComment(comment)}
          onReply={() => thread.startReplyingToComment(comment)}
          onDelete={() => thread.deleteOwnComment(comment)}
          onTogglePin={() => thread.togglePinOnComment(commentWithLocalChanges)}
          canHide={thread.canHideComment(commentWithLocalChanges)}
          onHide={() => thread.hideComment(commentWithLocalChanges)}
          onReplyWithVideo={thread.canReplyWithVideoTo(comment) ? () => thread.startVideoReplyTo(comment) : undefined}
          isPickingForVideoReply={thread.isPickingVideoReplyComment}
          isHighlighted={thread.highlightedCommentId === comment.id}
        />
      </View>
      {visibleReplies.map((reply) => (
        <CommentThread key={reply.id} comment={reply} nestingDepth={nestingDepth + 1} />
      ))}
      {showViewMoreLink || canLoadMoreExpandedReplies || showHideLink ? (
        <View style={[styles.links, { paddingLeft: Math.min(nestingDepth + 1, MAXIMUM_VISUAL_INDENT_LEVEL) * INDENT_WIDTH_PER_LEVEL }]}>
          {showViewMoreLink || canLoadMoreExpandedReplies ? (
            <ThreadLink
              label={
                repliesQuery.isFetching && isExpanded
                  ? "Loading replies…"
                  : isExpanded
                    ? "View more replies"
                    : describeHiddenReplyCount(hiddenReplyCount, visibleReplies.length > 0)
              }
              onPress={expandOrLoadMoreReplies}
            />
          ) : null}
          {showHideLink ? <ThreadLink label="Hide replies" onPress={() => thread.setReplyThreadVisibility(comment.id, "collapsed")} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function CommentChain({ comment, previewReplies, onShowMore }: { readonly comment: Comment; readonly previewReplies: readonly Comment[]; readonly onShowMore: () => void }) {
  const styles = useStyles();
  const thread = useCommentThreadContext();
  const serverChain = previewReplies.filter((reply) => !thread.isCommentDeleted(reply.id));
  const localReplies = [comment, ...serverChain].flatMap((node) => thread.locallyPostedCommentsFor(node.id));
  const chain = mergeServerAndLocalComments(serverChain, localReplies, false).filter((reply) => !thread.isCommentDeleted(reply.id));
  const hiddenCount = countRepliesHiddenFromChain(comment, serverChain);
  const rowFor = (node: Comment, connectBelow: boolean) => {
    const withLocalChanges = thread.applyLocalOverridesToComment(node);
    return (
      <CommentRow
        key={node.id}
        comment={withLocalChanges}
        connectBelow={connectBelow}
        isPending={isPendingComment(node)}
        canDelete={thread.canDeleteComment(node)}
        canPin={thread.canPinComment(withLocalChanges)}
        onToggleLike={() => thread.toggleLikeOnComment(node)}
        onReply={() => thread.startReplyingToComment(node)}
        onDelete={() => thread.deleteOwnComment(node)}
        onTogglePin={() => thread.togglePinOnComment(withLocalChanges)}
        canHide={thread.canHideComment(withLocalChanges)}
        onHide={() => thread.hideComment(withLocalChanges)}
        onReplyWithVideo={thread.canReplyWithVideoTo(node) ? () => thread.startVideoReplyTo(node) : undefined}
        isPickingForVideoReply={thread.isPickingVideoReplyComment}
        isHighlighted={thread.highlightedCommentId === node.id}
      />
    );
  };
  return (
    <View style={styles.thread}>
      {rowFor(comment, chain.length > 0)}
      {chain.map((reply, index) => rowFor(reply, index < chain.length - 1))}
      {hiddenCount > 0 ? (
        <View style={[styles.links, { paddingLeft: INDENT_WIDTH_PER_LEVEL }]}>
          <ThreadLink label={`Show ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"}`} onPress={onShowMore} />
        </View>
      ) : null}
    </View>
  );
}

function ThreadLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.linkRow}>
      <View style={styles.linkLine} />
      <Text size={12} weight={600} lineHeight={16.8} color={colors.textMuted} accessibilityRole="button" onPress={onPress}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  thread: { gap: 16 },
  links: { gap: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  linkLine: { width: 24, height: 1, backgroundColor: colors.divider },
}));
