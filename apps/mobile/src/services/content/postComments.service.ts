import type { Comment, CommentWithReplies, NewCommentInput, Page } from "@/types";

import { api } from "../core/apiClient.service";

export const postCommentsService = {
  fetchTopLevelCommentsForPost: (postId: string, cursor?: string) =>
    api.get<Page<CommentWithReplies>>(`/api/v1/posts/${postId}/comments`, { cursor }),
  fetchComment: (commentId: string) => api.get<Comment>(`/api/v1/comments/${commentId}`),
  fetchRepliesForComment: (commentId: string, cursor?: string) => api.get<Page<Comment>>(`/api/v1/comments/${commentId}/replies`, { cursor }),
  addCommentToPost: (postId: string, input: NewCommentInput) => api.post<Comment>(`/api/v1/posts/${postId}/comments`, input),
  likeComment: (commentId: string) => api.post<void>(`/api/v1/comments/${commentId}/like`),
  unlikeComment: (commentId: string) => api.delete<void>(`/api/v1/comments/${commentId}/like`),
  deleteComment: (commentId: string) => api.delete<void>(`/api/v1/comments/${commentId}`),
  pinComment: (postId: string, commentId: string) => api.put<Comment>(`/api/v1/posts/${postId}/comments/${commentId}/pin`),
  unpinComment: (postId: string, commentId: string) => api.delete<void>(`/api/v1/posts/${postId}/comments/${commentId}/pin`),
};
