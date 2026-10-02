import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Share, StyleSheet, View, type TextInput } from "react-native";

import { CommentComposer } from "@/components/clips/commentComposer";
import { CommentThreadContext, useCommentThreadController } from "@/components/clips/commentThreadController.hook";
import { ThreadedCommentList } from "@/components/clips/threadedCommentList";
import { PostCard } from "@/components/feed/postCard";
import { ReshareSheet } from "@/components/feed/reshareSheet";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { postsService } from "@/services/posts.service";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { useAuthStore } from "@/store/auth.store";
import type { Post } from "@/types";

export function PostDetailScreen({ navigation, route }: MainScreenProps<"PostDetail">) {
  const openUserProfile = useOpenUserProfile();
  const { postId } = route.params;
  const queryClient = useQueryClient();
  const composerRef = useRef<TextInput>(null);
  const myAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId) });
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const commentThread = useCommentThreadController(postId);

  const updateCachedPost = (change: (p: Post) => Post) => queryClient.setQueryData<Post>(["post", postId], (p) => (p ? change(p) : p));

  const toggleLikeOnPost = useMutation({
    mutationFn: (liked: boolean) => (liked ? postsService.unlikePost(postId) : postsService.likePost(postId)),
    onMutate: (liked) => updateCachedPost((p) => ({ ...p, liked: !liked, likes: p.likes + (liked ? -1 : 1) })),
    onError: (_, liked) => updateCachedPost((p) => ({ ...p, liked, likes: p.likes + (liked ? 1 : -1) })),
  });

  const sharePostLink = async () => {
    await Share.share({ message: `https://zudomart.com/posts/${postId}` }).catch(() => undefined);
    postsService.recordPostShare(postId).catch(() => undefined);
  };

  return (
    <Screen background={colors.white}>
      <CommentThreadContext.Provider value={commentThread}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Header title="Post" />
          <ThreadedCommentList
            commentHorizontalPadding={16}
            listHeader={
              post.data ? (
                <View style={styles.postBlock}>
                  <PostCard
                    post={post.data}
                    onPressAuthor={() => openUserProfile(post.data!.author.id)}
                    onToggleFollow={() => {
                      updateCachedPost((p) => ({ ...p, isFollowingAuthor: true }));
                      postsService.followPostAuthor(post.data!.author.id).catch(() => undefined);
                    }}
                    onToggleLike={() => toggleLikeOnPost.mutate(post.data!.liked)}
                    onPressComments={() => composerRef.current?.focus()}
                    onRepost={() => setReshareTarget(post.data ?? null)}
                    onShare={sharePostLink}
                    onPressOriginalPost={
                      post.data.resharedFrom ? () => navigation.navigate("PostDetail", { postId: post.data.resharedFrom!.id }) : undefined
                    }
                    onPressAnalytics={() => navigation.navigate("PostAnalytics", { postId: route.params.postId })}
                  />
                  <Text size={16} weight={600} lineHeight={19.2} style={styles.commentsTitle}>
                    Comments
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.list}
          />
          <CommentComposer
            ref={composerRef}
            myAvatarUrl={myAvatarUrl}
            replyTarget={commentThread.replyTarget}
            onCancelReply={commentThread.cancelReplyingToComment}
            onSubmit={commentThread.submitCommentOrReplyText}
          />
          <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
        </KeyboardAvoidingView>
      </CommentThreadContext.Provider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  postBlock: { gap: 16 },
  commentsTitle: { paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingBottom: 16 },
});
