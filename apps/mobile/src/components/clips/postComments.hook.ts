import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { postCommentsService } from "@/services/postComments.service";
import type { CommentWithReplies, Page } from "@/types";

export function usePostCommentsWithActions(postId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["post-comments", postId];

  const comments = useQuery({
    queryKey,
    queryFn: () => postCommentsService.fetchCommentsForPost(postId!),
    enabled: !!postId,
  });

  const addComment = useMutation({
    mutationFn: (text: string) => postCommentsService.addCommentToPost(postId!, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggleCommentLike = useMutation({
    mutationFn: (comment: CommentWithReplies) =>
      comment.liked ? postCommentsService.unlikeComment(comment.id) : postCommentsService.likeComment(comment.id),
    onMutate: (comment) => {
      queryClient.setQueryData<Page<CommentWithReplies>>(queryKey, (page) =>
        page
          ? {
              ...page,
              data: page.data.map((c) =>
                c.id === comment.id ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : c,
              ),
            }
          : page,
      );
    },
  });

  return { comments, addComment, toggleCommentLike };
}
