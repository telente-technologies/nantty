import type { Comment, CommentHiddenState, CommentWithReplies, MyPostComment, NewCommentInput, Page } from "@/types";
import type { CommentSectionFilter, QuoteThreadItem } from "@/types/postThread.type";

import { api } from "../core/apiClient.service";

export const postCommentsService = {
  fetchTopLevelCommentsForPost: (postId: string, cursor?: string, filter: CommentSectionFilter = "all") =>
    api.get<Page<CommentWithReplies | QuoteThreadItem>>(`/api/v1/posts/${postId}/comments`, { cursor, ...(filter === "all" ? {} : { filter }) }),
  fetchComment: (commentId: string) => api.get<Comment>(`/api/v1/comments/${commentId}`),
  fetchRepliesForComment: (commentId: string, cursor?: string) => api.get<Page<Comment>>(`/api/v1/comments/${commentId}/replies`, { cursor }),
  addCommentToPost: (postId: string, input: NewCommentInput) => api.post<Comment>(`/api/v1/posts/${postId}/comments`, input),
  likeComment: (commentId: string) => api.post<void>(`/api/v1/comments/${commentId}/like`),
  unlikeComment: (commentId: string) => api.delete<void>(`/api/v1/comments/${commentId}/like`),
  deleteComment: (commentId: string) => api.delete<void>(`/api/v1/comments/${commentId}`),
  pinComment: (postId: string, commentId: string) => api.put<Comment>(`/api/v1/posts/${postId}/comments/${commentId}/pin`),
  unpinComment: (postId: string, commentId: string) => api.delete<void>(`/api/v1/posts/${postId}/comments/${commentId}/pin`),
  hideComment: (postId: string, commentId: string) => api.put<CommentHiddenState>(`/api/v1/posts/${postId}/comments/${commentId}/hide`),
  unhideComment: (postId: string, commentId: string) => api.delete<CommentHiddenState>(`/api/v1/posts/${postId}/comments/${commentId}/hide`),
  fetchHiddenComments: (cursor?: string) => api.get<Page<MyPostComment>>("/api/v1/me/post-comments", { filter: "hidden", cursor }),
};
