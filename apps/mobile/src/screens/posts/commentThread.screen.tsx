import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CommentThreadContext, useCommentThreadController } from "@/components/clips/commentThreadController.hook";
import { toLocalThreadReply } from "@/components/feed/thread/postThread.hook";
import { ThreadComposer } from "@/components/feed/thread/threadComposer";
import { ThreadSkeleton } from "@/components/feed/thread/threadListParts";
import { ThreadReplyBranch } from "@/components/feed/thread/threadReplyBranch";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postCommentsService } from "@/services/postComments.service";
import { postsService } from "@/services/posts.service";
import { useTheme } from "@/theme";

export function CommentThreadScreen({ route }: MainScreenProps<"CommentThread">) {
  const { colors } = useTheme();
  const { commentId, postId } = route.params;
  const commentThread = useCommentThreadController(postId);
  const focus = useQuery({ queryKey: ["comment", commentId], queryFn: () => postCommentsService.fetchComment(commentId) });
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId) });
  const postAuthorId = post.data?.author.id;
  const { setReplyThreadVisibility, startReplyingToComment, replyTarget } = commentThread;
  useEffect(() => {
    setReplyThreadVisibility(commentId, "expanded");
  }, [commentId]);
  useEffect(() => {
    if (focus.data && !replyTarget) startReplyingToComment(focus.data);
  }, [focus.data, replyTarget]);

  return (
    <Screen background={colors.surface}>
      <CommentThreadContext.Provider value={commentThread}>
        <View style={styles.flex}>
          <Header title="Thread" />
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {focus.isLoading ? <ThreadSkeleton rows={2} /> : null}
            {focus.isError ? <ErrorState message="This reply isn't available." onRetry={() => focus.refetch()} /> : null}
            {focus.data ? (
              <ThreadReplyBranch reply={toLocalThreadReply(focus.data, postAuthorId, false)} postAuthorId={postAuthorId} hasParentAbove={false} showReplyingTo />
            ) : null}
          </ScrollView>
          <ThreadComposer
            postAuthorUsername={focus.data?.author.username}
            replyTarget={replyTarget ?? focus.data ?? null}
            onCancelReply={() => (focus.data ? startReplyingToComment(focus.data) : undefined)}
            onSubmit={commentThread.submitCommentOrReplyText}
            replyRestriction={post.data?.viewerCanReply === false ? (post.data.replyRestriction ?? null) : null}
          />
        </View>
      </CommentThreadContext.Provider>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { paddingBottom: 24 } });
