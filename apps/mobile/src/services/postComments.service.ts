import type { CommentWithReplies, Page } from "@/types";

import { api } from "./api-client.service";

export const postCommentsService = {
  fetchCommentsForPost: (postId: string, cursor?: string) =>
    api.get<Page<CommentWithReplies>>(`/api/v1/posts/${postId}/comments`, { cursor }),
  addCommentToPost: (postId: string, text: string, replyToCommentId?: string) =>
    api.post<CommentWithReplies>(`/api/v1/posts/${postId}/comments`, { text, replyToCommentId }),
  likeComment: (commentId: string) => api.post<void>(`/api/v1/comments/${commentId}/like`),
  unlikeComment: (commentId: string) => api.delete<void>(`/api/v1/comments/${commentId}/like`),
};
